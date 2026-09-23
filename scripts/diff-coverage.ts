/**
 * Diff coverage: the share of changed lines (and branches on them) that tests execute.
 * Fails when either is below the threshold, or when a changed file has no covered lines at all, so
 * every change ships with tests for its own code while untested legacy code doesn't block
 * unrelated work. Run after `bun run test:coverage`:
 *
 *   bun run coverage:diff                  # against the merge base with origin/develop
 *   bun run coverage:diff -- origin/main   # against another base
 *
 * Env: COVERAGE_BASE (base ref), COVERAGE_THRESHOLD (default 90), GITHUB_STEP_SUMMARY (CI).
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";

export type Ratio = { covered: number; total: number };

export type FileCoverage = {
  /** Line number → hit count, for instrumented lines only. */
  lines: Map<number, number>;
  /** Line number → branches on that line. */
  branches: Map<number, Ratio>;
};

export type FileResult = {
  file: string;
  lines: Ratio;
  branches: Ratio;
  uncoveredLines: number[];
};

export type Summary = { files: FileResult[]; lines: Ratio; branches: Ratio };

/** Parses an lcov report into per-file coverage, keyed by path relative to `root`. */
export function parseLcov(text: string, root: string): Map<string, FileCoverage> {
  const result = new Map<string, FileCoverage>();
  let current: FileCoverage | undefined;

  for (const line of text.split("\n")) {
    if (line.startsWith("SF:")) {
      const path = line.slice(3).trim();
      current = { lines: new Map(), branches: new Map() };
      result.set(isAbsolute(path) ? relative(root, path) : path, current);
    } else if (!current) {
      continue;
    } else if (line.startsWith("DA:")) {
      const [lineNo, hits] = line.slice(3).split(",");
      current.lines.set(Number(lineNo), Number(hits));
    } else if (line.startsWith("BRDA:")) {
      const [lineNo, , , taken] = line.slice(5).split(",");
      const branch = current.branches.get(Number(lineNo)) ?? { covered: 0, total: 0 };
      branch.total += 1;
      // "-" means the branch's condition was never evaluated.
      if (taken !== "-" && Number(taken) > 0) branch.covered += 1;
      current.branches.set(Number(lineNo), branch);
    } else if (line.startsWith("end_of_record")) {
      current = undefined;
    }
  }
  return result;
}

/** Parses a unified diff into the added line numbers (in the new file) for each file. */
export function parseDiff(text: string): Map<string, Set<number>> {
  const result = new Map<string, Set<number>>();
  let added: Set<number> | undefined;
  let lineNo = 0;

  for (const line of text.split("\n")) {
    if (line.startsWith("+++ ")) {
      const path = line.slice(4).trim();
      if (path === "/dev/null") {
        added = undefined;
      } else {
        added = new Set();
        result.set(path.replace(/^b\//, ""), added);
      }
    } else if (line.startsWith("--- ") || !added) {
      continue;
    } else if (line.startsWith("@@")) {
      // "@@ -a,b +c,d @@": the new file's hunk starts at line c.
      lineNo = Number(line.split(" ")[2].slice(1).split(",")[0]);
    } else if (line.startsWith("+")) {
      added.add(lineNo);
      lineNo += 1;
    } else if (line.startsWith(" ")) {
      lineNo += 1;
    }
    // "-" lines and "\ No newline at end of file" don't exist in the new file.
  }
  return result;
}

/** Percentage rounded down to one decimal, so 89.99 never displays or passes as 90. */
export function percent({ covered, total }: Ratio): number {
  if (total === 0) return 100;
  return Math.floor((covered / total) * 1000) / 10;
}

/** Coverage of the changed lines. Files absent from the report (docs, config) are ignored. */
export function computeDiffCoverage(
  coverage: Map<string, FileCoverage>,
  changed: Map<string, Set<number>>,
): Summary {
  const files: FileResult[] = [];
  const lines: Ratio = { covered: 0, total: 0 };
  const branches: Ratio = { covered: 0, total: 0 };

  for (const [file, changedLines] of changed) {
    const fileCoverage = coverage.get(file);
    if (!fileCoverage) continue;

    const result: FileResult = {
      file,
      lines: { covered: 0, total: 0 },
      branches: { covered: 0, total: 0 },
      uncoveredLines: [],
    };
    for (const lineNo of [...changedLines].sort((a, b) => a - b)) {
      const hits = fileCoverage.lines.get(lineNo);
      if (hits !== undefined) {
        result.lines.total += 1;
        if (hits > 0) result.lines.covered += 1;
        else result.uncoveredLines.push(lineNo);
      }
      const branch = fileCoverage.branches.get(lineNo);
      if (branch) {
        result.branches.total += branch.total;
        result.branches.covered += branch.covered;
      }
    }
    if (result.lines.total === 0 && result.branches.total === 0) continue;

    files.push(result);
    lines.total += result.lines.total;
    lines.covered += result.lines.covered;
    branches.total += result.branches.total;
    branches.covered += result.branches.covered;
  }
  return { files, lines, branches };
}

export function evaluate(
  summary: Summary,
  threshold: number,
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  for (const metric of ["lines", "branches"] as const) {
    const value = percent(summary[metric]);
    if (value < threshold) failures.push(`${metric} ${value}% < ${threshold}%`);
  }
  // The totals can hide a whole file nobody tested behind well-tested ones.
  const untested = summary.files.filter((f) => f.lines.total > 0 && f.lines.covered === 0);
  if (untested.length > 0)
    failures.push(`untested files: ${untested.map((f) => f.file).join(", ")}`);
  return { passed: failures.length === 0, failures };
}

/** Markdown report for the terminal and the GitHub Actions job summary. */
export function formatReport(summary: Summary, threshold: number): string {
  const { passed, failures } = evaluate(summary, threshold);
  const out = ["## Diff coverage", ""];

  if (summary.files.length === 0) {
    out.push("No changed lines in instrumented files.", "");
  } else {
    out.push(
      "| Metric | Covered | % |",
      "| --- | --- | --- |",
      `| Lines | ${summary.lines.covered}/${summary.lines.total} | ${percent(summary.lines)}% |`,
      `| Branches | ${summary.branches.covered}/${summary.branches.total} | ${percent(summary.branches)}% |`,
      "",
      "| File | Lines | Branches | Uncovered lines |",
      "| --- | --- | --- | --- |",
      ...summary.files.map(
        (f) =>
          `| \`${f.file}\` | ${percent(f.lines)}% | ${percent(f.branches)}% | ${f.uncoveredLines.join(", ") || "–"} |`,
      ),
      "",
    );
  }
  out.push(
    passed
      ? `✅ At or above ${threshold}%.`
      : `❌ Diff coverage failed (${threshold}% required): ${failures.join(", ")}. Add tests for the uncovered lines.`,
  );
  return out.join("\n");
}

export type RunOptions = {
  /** Git ref to diff against; the merge base with HEAD is used. */
  base: string;
  /** Minimum percentage for changed lines and branches. */
  threshold: number;
  cwd: string;
  /** lcov report, relative to `cwd`. */
  lcovPath: string;
  /** GitHub Actions job summary file to append the report to. */
  summaryPath?: string;
  log: (line: string) => void;
};

/** Changed lines since the merge base, plus uncommitted and untracked files (local TDD loop). */
function changedLines(base: string, cwd: string): Map<string, Set<number>> {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

  const mergeBase = git("merge-base", base, "HEAD").trim();
  const changed = parseDiff(git("diff", "--unified=0", "--no-color", "--no-ext-diff", mergeBase));
  for (const file of git("ls-files", "--others", "--exclude-standard")
    .split("\n")
    .filter(Boolean)) {
    const count = readFileSync(join(cwd, file), "utf8").split("\n").length;
    changed.set(file, new Set(Array.from({ length: count }, (_, i) => i + 1)));
  }
  return changed;
}

/** Checks diff coverage and reports it. Returns the process exit code. */
export function run({ base, threshold, cwd, lcovPath, summaryPath, log }: RunOptions): number {
  const lcovFile = join(cwd, lcovPath);
  if (!existsSync(lcovFile)) {
    log(`${lcovPath} not found. Run \`bun run test:coverage\` first.`);
    return 1;
  }

  const summary = computeDiffCoverage(
    parseLcov(readFileSync(lcovFile, "utf8"), cwd),
    changedLines(base, cwd),
  );
  const report = formatReport(summary, threshold);

  log(`Base: ${base}\n\n${report}`);
  if (summaryPath) appendFileSync(summaryPath, `${report}\n`);
  return evaluate(summary, threshold).passed ? 0 : 1;
}

/** Options from CLI args and env. An argument base wins over COVERAGE_BASE. */
export function optionsFromCli(
  args: string[],
  env: Record<string, string | undefined>,
  cwd: string,
  log: RunOptions["log"],
): RunOptions {
  return {
    base: args[0] ?? env.COVERAGE_BASE ?? "origin/develop",
    threshold: Number(env.COVERAGE_THRESHOLD ?? 90),
    cwd,
    lcovPath: "coverage/lcov.info",
    summaryPath: env.GITHUB_STEP_SUMMARY,
    log,
  };
}

if (import.meta.main) {
  process.exitCode = run(
    optionsFromCli(process.argv.slice(2), process.env, process.cwd(), console.log),
  );
}
