#!/usr/bin/env node
/**
 * Bumps package.json + jsr.json, opens release/VERSION → main PR, enables auto-merge.
 * Usage: node scripts/create-release-pr.mjs [VERSION]
 * If VERSION is omitted, bumps the patch segment of the current package.json version.
 */
import { execFileSync, execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function sh(cmd, inherit = false) {
  return execSync(cmd, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: inherit ? "inherit" : "pipe",
  }).trim();
}

function gh(args, inherit = false) {
  if (inherit) {
    execFileSync("gh", args, { cwd: repoRoot, stdio: "inherit" });
    return "";
  }
  return execFileSync("gh", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

function ensureCleanWorkingTree() {
  const out = sh("git status --porcelain");
  if (out) {
    throw new Error(
      "Working tree is not clean. Commit or stash changes before running this script.",
    );
  }
}

function refExists(ref) {
  try {
    execSync(`git rev-parse --verify --quiet "${ref}"`, {
      cwd: repoRoot,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function remoteHeadsHas(branch) {
  const out = sh(`git ls-remote --heads origin "${branch}"`);
  return out.length > 0;
}

function parseSemver(v) {
  const m = String(v).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    throw new Error(`VERSION must be semver X.Y.Z (got ${JSON.stringify(v)})`);
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function bumpPatch(version) {
  const [a, b, c] = parseSemver(version);
  return `${a}.${b}.${c + 1}`;
}

function cmpVersion(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, obj) {
  writeFileSync(path, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
}

function main() {
  process.chdir(repoRoot);

  const arg = process.argv[2];
  const pkgPath = join(repoRoot, "package.json");
  const jsrPath = join(repoRoot, "jsr.json");

  ensureCleanWorkingTree();

  const pkg = readJson(pkgPath);
  const current = pkg.version;
  const target = arg ? String(arg).trim() : bumpPatch(current);

  parseSemver(target);
  if (cmpVersion(target, current) <= 0) {
    throw new Error(
      `New version must be greater than current ${current} (got ${target})`,
    );
  }

  sh("git fetch origin main", true);
  sh("git checkout main", true);
  sh("git pull --ff-only origin main", true);

  const branch = `release/${target}`;
  if (refExists(`refs/heads/${branch}`)) {
    throw new Error(
      `Local branch ${branch} already exists. Delete it or pick another version.`,
    );
  }
  if (remoteHeadsHas(branch)) {
    throw new Error(
      `Remote branch origin/${branch} already exists. Delete it or pick another version.`,
    );
  }

  sh(`git checkout -b "${branch}"`, true);

  pkg.version = target;
  writeJson(pkgPath, pkg);

  const jsr = readJson(jsrPath);
  jsr.version = target;
  writeJson(jsrPath, jsr);

  sh(`git add package.json jsr.json`, true);
  sh(`git commit -m "chore(release): bump version to ${target}"`, true);
  sh(`git push -u origin "${branch}"`, true);

  const body = [
    "Automated release PR.",
    "",
    `- Bumps \`package.json\` and \`jsr.json\` to **${target}**`,
    `- Merging publishes GitHub release \`v-${target}\` and triggers npm/JSR publish (see \`.github/workflows/\`).`,
  ].join("\n");

  const prUrl = gh([
    "pr",
    "create",
    "--base",
    "main",
    "--head",
    branch,
    "--title",
    `Release ${target}`,
    "--body",
    body,
  ]);

  console.log(prUrl);

  try {
    gh(["pr", "merge", prUrl, "--auto", "--merge"], true);
    console.log("Auto-merge enabled; PR will merge when required checks pass.");
  } catch {
    console.warn(
      "\nCould not enable auto-merge (repo may not allow it, or checks are pending). Merge the PR manually when ready.",
    );
  }
}

main();
