import git from "isomorphic-git";
import { Volume, createFsFromVolume } from "memfs";

/**
 * Rule repository. A real git repository (isomorphic-git) on an in-memory file system:
 * every draft is a commit on a draft/* branch with a real SHA, and rollback is a revert commit.
 * Agents reach it only through the git-draft MCP server, which refuses writes to main.
 */

const DIR = "/rules";
const AUTHOR = { name: "NIYAM Author Agent", email: "author@niyam.agents" };

export interface CommitInfo {
  sha: string;
  short: string;
  branch: string;
  message: string;
}

export class RuleRepo {
  private fs: any;
  private constructor(fs: any) {
    this.fs = fs;
  }

  static async init(seedFiles: Record<string, string>): Promise<{ repo: RuleRepo; commit: CommitInfo }> {
    const vol = new Volume();
    const fs = createFsFromVolume(vol);
    const repo = new RuleRepo(fs);
    await fs.promises.mkdir(DIR, { recursive: true });
    await git.init({ fs, dir: DIR, defaultBranch: "main" });
    for (const [file, content] of Object.entries(seedFiles)) {
      await fs.promises.writeFile(`${DIR}/${file}`, content);
      await git.add({ fs, dir: DIR, filepath: file });
    }
    const commit = await repo.commit("main", "Seed live rules v1 from MD-SYN-LEF-2025", {
      name: "Bank Rule Ops (seed)",
      email: "ruleops@bank.example",
    });
    return { repo, commit };
  }

  private async commit(branch: string, message: string, author = AUTHOR): Promise<CommitInfo> {
    const sha = await git.commit({
      fs: this.fs,
      dir: DIR,
      message,
      author: { ...author, timestamp: 1790000000, timezoneOffset: -330 },
    });
    return { sha, short: sha.slice(0, 7), branch, message };
  }

  async currentBranch() {
    return (await git.currentBranch({ fs: this.fs, dir: DIR })) ?? "main";
  }

  async checkout(branch: string, create = false) {
    if (create) {
      const branches = await git.listBranches({ fs: this.fs, dir: DIR });
      if (!branches.includes(branch)) await git.branch({ fs: this.fs, dir: DIR, ref: branch });
    }
    await git.checkout({ fs: this.fs, dir: DIR, ref: branch, force: true });
  }

  async read(file: string, ref?: string): Promise<string | undefined> {
    try {
      if (ref) {
        const oid = await git.resolveRef({ fs: this.fs, dir: DIR, ref });
        const { blob } = await git.readBlob({ fs: this.fs, dir: DIR, oid, filepath: file });
        return new TextDecoder().decode(blob);
      }
      return (await this.fs.promises.readFile(`${DIR}/${file}`, "utf8")) as string;
    } catch {
      return undefined;
    }
  }

  /** Write a file on a draft branch and commit it. Writes to main are refused. */
  async commitDraft(branch: string, file: string, content: string, message: string): Promise<CommitInfo> {
    if (!branch.startsWith("draft/")) {
      throw new Error(`Refused: agents may only commit to draft/* branches, not "${branch}"`);
    }
    if ((await this.currentBranch()) !== branch) await this.checkout(branch, true);
    await this.fs.promises.writeFile(`${DIR}/${file}`, content);
    await git.add({ fs: this.fs, dir: DIR, filepath: file });
    return this.commit(branch, message);
  }

  /** Merge an approved draft branch into main (fast-forward). Only the Release path calls this. */
  async promote(branch: string, approvedBy: string[]): Promise<CommitInfo> {
    await this.checkout("main");
    await git.merge({
      fs: this.fs,
      dir: DIR,
      ours: "main",
      theirs: branch,
      fastForwardOnly: true,
      author: { name: "NIYAM Release Agent", email: "release@niyam.agents", timestamp: 1790000000, timezoneOffset: -330 },
    });
    await this.checkout("main");
    const sha = await git.resolveRef({ fs: this.fs, dir: DIR, ref: "main" });
    return { sha, short: sha.slice(0, 7), branch: "main", message: `Promote ${branch} (approved by ${approvedBy.join(", ")})` };
  }

  /** Revert a file on main to the content it had at `ref`, as a new commit. */
  async revertFile(file: string, ref: string, message: string): Promise<CommitInfo> {
    const content = await this.read(file, ref);
    if (content === undefined) throw new Error(`Cannot revert ${file}: missing at ${ref}`);
    await this.checkout("main");
    await this.fs.promises.writeFile(`${DIR}/${file}`, content);
    await git.add({ fs: this.fs, dir: DIR, filepath: file });
    return this.commit("main", message, { name: "NIYAM Sentinel (auto-rollback)", email: "sentinel@niyam.agents" });
  }

  async log(ref = "main", depth = 20) {
    const entries = await git.log({ fs: this.fs, dir: DIR, ref, depth });
    return entries.map((e) => ({
      sha: e.oid,
      short: e.oid.slice(0, 7),
      message: e.commit.message.trim(),
      author: e.commit.author.name,
    }));
  }

  async listBranches() {
    return git.listBranches({ fs: this.fs, dir: DIR });
  }
}

/** Minimal unified line diff (LCS) for showing rule changes. */
export function unifiedDiff(a: string, b: string, fileA = "a", fileB = "b"): string {
  const x = a.split("\n");
  const y = b.split("\n");
  const n = x.length;
  const m = y.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: string[] = [`--- ${fileA}`, `+++ ${fileB}`];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      out.push(`  ${x[i]}`);
      i++;
      j++;
    } else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) {
      out.push(`+ ${y[j]}`);
      j++;
    } else {
      out.push(`- ${x[i]}`);
      i++;
    }
  }
  return out.join("\n");
}
