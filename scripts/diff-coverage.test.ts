import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type RunOptions,
  computeDiffCoverage,
  evaluate,
  formatReport,
  parseDiff,
  parseLcov,
  optionsFromCli,
  percent,
  run,
} from "./diff-coverage";

const ROOT = "/repo";

const LCOV = `TN:
SF:/repo/src/lib/a.ts
DA:1,1
DA:2,0
DA:3,4
BRDA:3,0,0,2
BRDA:3,0,1,0
end_of_record
TN:
SF:/repo/src/lib/b.ts
DA:10,0
BRDA:10,1,0,-
BRDA:10,1,1,-
end_of_record
`;

describe("parseLcov", () => {
  it("keys files by repo-relative path with line hits", () => {
    const coverage = parseLcov(LCOV, ROOT);

    expect([...coverage.keys()]).toEqual(["src/lib/a.ts", "src/lib/b.ts"]);
    expect(coverage.get("src/lib/a.ts")?.lines).toEqual(
      new Map([
        [1, 1],
        [2, 0],
        [3, 4],
      ]),
    );
  });

  it("totals branches per line, treating '-' (never reached) as not taken", () => {
    const coverage = parseLcov(LCOV, ROOT);

    expect(coverage.get("src/lib/a.ts")?.branches.get(3)).toEqual({ covered: 1, total: 2 });
    expect(coverage.get("src/lib/b.ts")?.branches.get(10)).toEqual({ covered: 0, total: 2 });
  });

  it("skips the record types it doesn't use (FN, FNDA, LF, LH, BRF, BRH)", () => {
    const coverage = parseLcov(
      "TN:\nSF:src/x.ts\nFN:1,f\nFNDA:1,f\nFNF:1\nFNH:1\nDA:1,1\nLF:1\nLH:1\nBRF:0\nBRH:0\nend_of_record\n",
      ROOT,
    );
    expect(coverage.get("src/x.ts")).toEqual({ lines: new Map([[1, 1]]), branches: new Map() });
  });

  it("keeps relative SF paths as they are", () => {
    const coverage = parseLcov("SF:src/x.ts\nDA:1,1\nend_of_record\n", ROOT);
    expect([...coverage.keys()]).toEqual(["src/x.ts"]);
  });
});

describe("parseDiff", () => {
  it("collects added line numbers in the new file for each changed file", () => {
    const diff = `diff --git a/src/lib/a.ts b/src/lib/a.ts
index 1111111..2222222 100644
--- a/src/lib/a.ts
+++ b/src/lib/a.ts
@@ -1,0 +2,2 @@
+const x = 1;
+const y = 2;
@@ -9 +11 @@
-old
+new
`;
    expect(parseDiff(diff)).toEqual(new Map([["src/lib/a.ts", new Set([2, 3, 11])]]));
  });

  it("counts context lines when the diff has them", () => {
    const diff = `--- a/src/a.ts
+++ b/src/a.ts
@@ -5,3 +5,4 @@
 keep
-gone
+added
 keep
+also added
`;
    expect(parseDiff(diff).get("src/a.ts")).toEqual(new Set([6, 8]));
  });

  it("uses the new path for renames and new files, and skips deleted files", () => {
    const diff = `--- a/src/old.ts
+++ b/src/new.ts
@@ -1 +1 @@
-a
+b
--- /dev/null
+++ b/src/created.ts
@@ -0,0 +1,2 @@
+one
+two
--- a/src/deleted.ts
+++ /dev/null
@@ -1,2 +0,0 @@
-one
-two
`;
    expect(parseDiff(diff)).toEqual(
      new Map([
        ["src/new.ts", new Set([1])],
        ["src/created.ts", new Set([1, 2])],
      ]),
    );
  });

  it("ignores the no-newline marker", () => {
    const diff = `--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1 @@
-a
\\ No newline at end of file
+b
`;
    expect(parseDiff(diff).get("src/a.ts")).toEqual(new Set([1]));
  });
});

describe("percent", () => {
  it("is 100 when there is nothing to measure", () => {
    expect(percent({ covered: 0, total: 0 })).toBe(100);
  });

  it("rounds down to one decimal so 89.99 never passes as 90", () => {
    expect(percent({ covered: 8999, total: 10000 })).toBe(89.9);
    expect(percent({ covered: 2, total: 3 })).toBe(66.6);
  });
});

describe("computeDiffCoverage", () => {
  const coverage = parseLcov(LCOV, ROOT);

  it("measures only changed lines that are instrumented", () => {
    // Line 4 has no DA entry (a comment or type), so it isn't counted.
    const result = computeDiffCoverage(coverage, new Map([["src/lib/a.ts", new Set([1, 2, 4])]]));

    expect(result.lines).toEqual({ covered: 1, total: 2 });
    expect(result.files).toEqual([
      {
        file: "src/lib/a.ts",
        lines: { covered: 1, total: 2 },
        branches: { covered: 0, total: 0 },
        uncoveredLines: [2],
      },
    ]);
  });

  it("measures branches on changed lines", () => {
    const result = computeDiffCoverage(coverage, new Map([["src/lib/a.ts", new Set([3])]]));

    expect(result.lines).toEqual({ covered: 1, total: 1 });
    expect(result.branches).toEqual({ covered: 1, total: 2 });
  });

  it("ignores changed files outside the coverage report (docs, config)", () => {
    const result = computeDiffCoverage(
      coverage,
      new Map([
        ["README.md", new Set([1, 2])],
        ["src/lib/b.ts", new Set([10])],
      ]),
    );

    expect(result.files.map((f) => f.file)).toEqual(["src/lib/b.ts"]);
    expect(result.lines).toEqual({ covered: 0, total: 1 });
    expect(result.branches).toEqual({ covered: 0, total: 2 });
  });

  it("omits covered files whose changes are not instrumented", () => {
    const result = computeDiffCoverage(coverage, new Map([["src/lib/a.ts", new Set([99])]]));
    expect(result.files).toEqual([]);
    expect(result.lines).toEqual({ covered: 0, total: 0 });
  });
});

describe("evaluate", () => {
  it("passes at or above the threshold", () => {
    const summary = {
      files: [],
      lines: { covered: 9, total: 10 },
      branches: { covered: 0, total: 0 },
    };
    expect(evaluate(summary, 90)).toEqual({ passed: true, failures: [] });
  });

  it("fails a changed file with no covered lines, even when the total passes", () => {
    const untested = {
      file: "src/lib/forgot.ts",
      lines: { covered: 0, total: 2 },
      branches: { covered: 0, total: 0 },
      uncoveredLines: [1, 2],
    };
    const summary = {
      files: [untested],
      lines: { covered: 98, total: 100 },
      branches: { covered: 0, total: 0 },
    };
    expect(evaluate(summary, 90)).toEqual({
      passed: false,
      failures: ["untested files: src/lib/forgot.ts"],
    });
  });

  it("fails each metric below the threshold", () => {
    const summary = {
      files: [],
      lines: { covered: 8, total: 10 },
      branches: { covered: 1, total: 2 },
    };
    expect(evaluate(summary, 90)).toEqual({
      passed: false,
      failures: ["lines 80% < 90%", "branches 50% < 90%"],
    });
  });
});

describe("formatReport", () => {
  it("summarizes totals and lists uncovered lines per file", () => {
    const summary = computeDiffCoverage(
      parseLcov(LCOV, ROOT),
      new Map([["src/lib/a.ts", new Set([1, 2, 3])]]),
    );
    const report = formatReport(summary, 90);

    expect(report).toContain("## Diff coverage");
    expect(report).toContain("| Lines | 2/3 | 66.6% |");
    expect(report).toContain("| Branches | 1/2 | 50% |");
    expect(report).toContain("| `src/lib/a.ts` | 66.6% | 50% | 2 |");
    expect(report).toContain(
      "❌ Diff coverage failed (90% required): lines 66.6% < 90%, branches 50% < 90%.",
    );
  });

  it("says so when the change has no measurable code", () => {
    const report = formatReport(computeDiffCoverage(new Map(), new Map()), 90);
    expect(report).toContain("No changed lines in instrumented files.");
    expect(report).toContain("✅");
  });
});

describe("run (against a real git repo)", () => {
  let dir: string;
  let output: string[];

  const sh = (...args: string[]) =>
    execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir });

  const lcov = (hits: Record<string, number[]>) =>
    Object.entries(hits)
      .map(
        ([file, lines]) =>
          `SF:${join(dir, file)}\n${lines.map((h, i) => `DA:${i + 1},${h}`).join("\n")}\nend_of_record`,
      )
      .join("\n");

  const runIn = (overrides: Partial<RunOptions> = {}) =>
    run({
      base: "base",
      threshold: 90,
      cwd: dir,
      lcovPath: "coverage/lcov.info",
      log: (line) => output.push(line),
      ...overrides,
    });

  beforeEach(() => {
    output = [];
    dir = mkdtempSync(join(tmpdir(), "diff-coverage-"));
    sh("init", "-q", "-b", "base");
    writeFileSync(join(dir, "a.ts"), "one\ntwo\n");
    sh("add", ".");
    sh("commit", "-q", "-m", "base");
    sh("checkout", "-q", "-b", "feature");
    // A committed change on line 2, and an untracked new file.
    writeFileSync(join(dir, "a.ts"), "one\nTWO\n");
    sh("commit", "-q", "-am", "change");
    writeFileSync(join(dir, "new.ts"), "x\ny\n");
    mkdirSync(join(dir, "coverage"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("passes when changed and untracked lines are covered", () => {
    writeFileSync(join(dir, "coverage/lcov.info"), lcov({ "a.ts": [0, 1], "new.ts": [1, 1] }));

    expect(runIn()).toBe(0);
    // Line 1 of a.ts is unchanged, so its 0 hits don't count.
    expect(output.join("\n")).toContain("| Lines | 3/3 | 100% |");
  });

  it("fails when a changed line is uncovered, and names it", () => {
    writeFileSync(join(dir, "coverage/lcov.info"), lcov({ "a.ts": [1, 0], "new.ts": [1, 1] }));

    expect(runIn()).toBe(1);
    expect(output.join("\n")).toContain("| `a.ts` | 0% | 100% | 2 |");
  });

  it("appends the report to the job summary file when given one", () => {
    writeFileSync(join(dir, "coverage/lcov.info"), lcov({ "a.ts": [1, 1], "new.ts": [1, 1] }));
    const summaryPath = join(dir, "summary.md");

    runIn({ summaryPath });
    expect(readFileSync(summaryPath, "utf8")).toContain("## Diff coverage");
  });

  it("fails with a hint when there is no coverage report", () => {
    expect(runIn()).toBe(1);
    expect(output.join("\n")).toContain("Run `bun run test:coverage` first.");
  });
});

describe("optionsFromCli", () => {
  const log = () => {};

  it("defaults to origin/develop, 90%, and no job summary", () => {
    expect(optionsFromCli([], {}, "/repo", log)).toEqual({
      base: "origin/develop",
      threshold: 90,
      cwd: "/repo",
      lcovPath: "coverage/lcov.info",
      summaryPath: undefined,
      log,
    });
  });

  it("reads base, threshold, and job summary from the environment", () => {
    const options = optionsFromCli(
      [],
      { COVERAGE_BASE: "origin/main", COVERAGE_THRESHOLD: "95", GITHUB_STEP_SUMMARY: "/s.md" },
      "/repo",
      log,
    );
    expect(options).toMatchObject({ base: "origin/main", threshold: 95, summaryPath: "/s.md" });
  });

  it("prefers a base passed as an argument over the environment", () => {
    const options = optionsFromCli(["origin/hotfix"], { COVERAGE_BASE: "origin/main" }, "/r", log);
    expect(options.base).toBe("origin/hotfix");
  });
});
