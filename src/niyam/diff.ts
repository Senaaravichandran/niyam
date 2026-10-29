export interface DiffLine {
  sign: " " | "+" | "-";
  text: string;
}

/** Line diff by longest common subsequence. Small inputs only (rule files). */
export function diffLines(a: string, b: string): DiffLine[] {
  const x = a ? a.split("\n") : [];
  const y = b ? b.split("\n") : [];
  const n = x.length;
  const m = y.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      out.push({ sign: " ", text: x[i] });
      i++;
      j++;
    } else if (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1])) {
      out.push({ sign: "-", text: x[i] });
      i++;
    } else {
      out.push({ sign: "+", text: y[j] });
      j++;
    }
  }
  return out.filter((l, k, arr) => !(l.text === "" && k === arr.length - 1));
}

export function unifiedDiff(a: string, b: string, fileA = "a", fileB = "b"): string {
  return [`--- ${fileA}`, `+++ ${fileB}`, ...diffLines(a, b).map((l) => `${l.sign} ${l.text}`)].join("\n");
}
