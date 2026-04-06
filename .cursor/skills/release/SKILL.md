---
name: release
description: >-
  Bumps package.json and jsr.json, pushes branch release/VERSION, opens a PR to
  main with auto-merge, and relies on CI to publish a GitHub release after merge.
  Use when the user invokes /release or /release VERSION, asks for a release PR,
  or wants to ship a new semver version.
---

# Release (`/release` [VERSION])

In chat, users may type **`/release`** (patch bump) or **`/release 1.2.3`** (explicit semver). Treat that as this workflow.

## Goal

Cut a **release PR** from `release/<VERSION>` → `main` with version bumps in `package.json` and `jsr.json`. Optional **VERSION** defaults to **patch bump** from the current `package.json` version.

## Preconditions

- Clean git working tree (no uncommitted changes).
- `git` and [`gh`](https://cli.github.com/) installed and authenticated (`gh auth login`).
- Repo default branch is `main`.
- Remote branch `release/<VERSION>` must not already exist.

## Steps

1. **Resolve VERSION** (if the user did not pass one): read `package.json` `version`, bump **patch** (e.g. `0.2.1` → `0.2.2`).
2. **Run the automation script** from the repo root (preferred):

   ```bash
   npm run release:pr -- [VERSION]
   ```

   Or: `node scripts/create-release-pr.mjs [VERSION]`. Omit `[VERSION]` for patch bump.

3. If the script cannot enable auto-merge, tell the user to merge the PR manually once CI passes.

## After merge

Merging into `main` triggers `.github/workflows/release-on-merge.yml`, which creates GitHub release tag `v-<VERSION>` and release notes. That **published** release runs `publish.yml` (npm + JSR).

## Tag convention

GitHub release tag: `v-${VERSION}` (e.g. `0.2.2` → tag `v-0.2.2`), matching `publish.yml` expectations.

## Do not

- Commit unrelated files (e.g. stray `site/` or local-only dirs) on the release branch.
- Bump only one of `package.json` / `jsr.json`; both must match for publish.
