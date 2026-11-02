import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import type { CapitalRow, LoanRow } from "../data/loanBook";
import { DAYS, DEFAULT_SHAPE, LOAN_BOOK_SEED, generateLoanBook, type BookShape } from "../data/loanBook";

/**
 * Sandbox SQL engine. Compiled rules are plain analytical SQL; in this deployment they execute on
 * SQLite compiled to WebAssembly so the whole system runs inside one serverless function. The same
 * SQL runs on DuckDB in the production design.
 */

let sqlPromise: Promise<SqlJsStatic> | null = null;

function loadSql(): Promise<SqlJsStatic> {
  if (!sqlPromise) {
    const wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
    const wasmBinary = fs.readFileSync(wasmPath);
    sqlPromise = initSqlJs({
      wasmBinary: wasmBinary.buffer.slice(
        wasmBinary.byteOffset,
        wasmBinary.byteOffset + wasmBinary.byteLength,
      ) as ArrayBuffer,
    });
  }
  return sqlPromise;
}

export const ENGINE_LABEL = "SQLite 3 (WebAssembly) sandbox, DuckDB-compatible SQL";

const DDL = `
CREATE TABLE loans (
  as_of TEXT NOT NULL,
  account_id TEXT NOT NULL,
  borrower_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  sector TEXT NOT NULL,
  outstanding_amt REAL NOT NULL,
  board_approved INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE capital (as_of TEXT PRIMARY KEY, tier1_amt REAL NOT NULL);
CREATE INDEX loans_day ON loans(as_of);
`;

export async function createDb(loans: LoanRow[], capital: CapitalRow[]): Promise<Database> {
  const SQL = await loadSql();
  const db = new SQL.Database();
  db.exec(DDL);
  db.exec("BEGIN");
  const ins = db.prepare(
    "INSERT INTO loans VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const r of loans) {
    ins.run([r.as_of, r.account_id, r.borrower_id, r.group_id, r.sector, r.outstanding_amt, r.board_approved]);
  }
  ins.free();
  const cap = db.prepare("INSERT INTO capital VALUES (?, ?)");
  for (const c of capital) cap.run([c.as_of, c.tier1_amt]);
  cap.free();
  db.exec("COMMIT");
  // Rule queries never write: the sandbox is read-only once loaded.
  db.exec("PRAGMA query_only = 1");
  return db;
}

export interface AlertRow {
  as_of: string;
  subject_id: string;
  metric_value: number;
}

/** Strips SQL comments and the trailing semicolon, and refuses anything but one SELECT. */
function singleStatement(sql: string): string {
  const body = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .trim()
    .replace(/;\s*$/, "");
  if (body.includes(";")) throw new Error("Refused: a compiled rule must be a single SQL statement");
  if (!/^(SELECT|WITH)\b/i.test(body)) throw new Error("Refused: a compiled rule must be a SELECT");
  return body;
}

/** Runs exactly one read-only statement and returns its rows. */
export function runQuery(db: Database, sql: string): AlertRow[] {
  const stmt = db.prepare(singleStatement(sql));
  const rows: AlertRow[] = [];
  try {
    while (stmt.step()) rows.push(stmt.getAsObject() as unknown as AlertRow);
  } finally {
    stmt.free();
  }
  return rows;
}

const g = globalThis as unknown as {
  __niyamBook?: Record<string, Promise<Database>>;
  __niyamForward?: Record<string, Promise<Database>>;
};

/** Which synthetic book to build: a seed plus the bank's shape. The default is the original book. */
export interface BookKey {
  id: string;
  seed: number;
  shape: BookShape;
}

const DEFAULT_BOOK: BookKey = { id: "default", seed: LOAN_BOOK_SEED, shape: DEFAULT_SHAPE };

export const FORWARD_DAYS = 12;
/** Rollout day (1-based) on which the injected data fault starts. */
export const DRIFT_FROM_DAY = 10;

/** The 90-day synthetic book used for backtests, built once per bank per server instance. */
export function getBookDb(key: BookKey = DEFAULT_BOOK): Promise<Database> {
  g.__niyamBook ??= {};
  if (!g.__niyamBook[key.id]) {
    const book = generateLoanBook(key.seed, DAYS, key.shape);
    g.__niyamBook[key.id] = createDb(book.loans, book.capital);
  }
  return g.__niyamBook[key.id];
}

/**
 * The 12 days after approval, continuing the same seeded walk. With `drift`, the loan feed is
 * loaded twice from rollout day 10 (a duplicated ETL batch), doubling every exposure.
 */
export function getForwardDb(drift: boolean, bk: BookKey = DEFAULT_BOOK): Promise<Database> {
  g.__niyamForward ??= {};
  const key = `${bk.id}:${drift ? "drift" : "clean"}`;
  if (!g.__niyamForward[key]) {
    const book = generateLoanBook(bk.seed, 90 + FORWARD_DAYS, bk.shape);
    const fwdDates = new Set(book.dates.slice(90));
    const driftDates = new Set(book.dates.slice(90 + DRIFT_FROM_DAY - 1));
    const loans: LoanRow[] = [];
    for (const r of book.loans) {
      if (!fwdDates.has(r.as_of)) continue;
      loans.push(r);
      if (drift && driftDates.has(r.as_of)) loans.push({ ...r, account_id: `${r.account_id}-DUP` });
    }
    g.__niyamForward[key] = createDb(loans, book.capital.filter((c) => fwdDates.has(c.as_of)));
  }
  return g.__niyamForward[key];
}
