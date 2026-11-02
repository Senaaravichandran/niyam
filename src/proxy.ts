import { NextResponse, type NextRequest } from "next/server";

/**
 * Each bank's subdomain serves that bank's rule-engine site at its root. The hosts mirror
 * BankDef.host in src/niyam/data/banks.ts; kept inline so the proxy stays small.
 */
const BANK_HOSTS: Record<string, string> = {
  "abc-bank-niyam.vercel.app": "abc",
  "def-bank-niyam.vercel.app": "def",
  "ghi-bank-niyam.vercel.app": "ghi",
  "jkl-finance-niyam.vercel.app": "jkl",
};

export function proxy(request: NextRequest) {
  const key = BANK_HOSTS[(request.headers.get("host") ?? "").toLowerCase().split(":")[0]];
  if (key) return NextResponse.rewrite(new URL(`/bank/${key}`, request.url));
  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
