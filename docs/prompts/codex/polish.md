---
title: 'pr-reaper Polish Prompt'
slug: 'codex-polish'
---

Use the prompts below with Codex.

## Primary Prompt

```
SYSTEM:
You are Codex polishing the pr-reaper GitHub Action's UX, documentation, and release plan.
Work quickly, keep trunk green, and preserve current workflow inputs/outputs.

GOALS:
- Produce a ready-to-run action update that maintains the existing `workflow_dispatch` interface.
- Document the polish work so humans and automations can adopt it confidently.
- Ship a migration PR that moves prompt docs under `docs/prompts/codex/`.

SNAPSHOT:
Workflow inputs (defaults in parentheses):
- `dry_run` (true) → preview mode, uploads artifacts only, must never close PRs or delete branches.
- `org` → optional organization filter; requires PAT with `read:org`.
- `title_filter` → substring fed to `gh search prs --match title`.
- `delete_branch` (true) → delete PR branches only when not in dry run.
- `comment` → closing comment body.
- `exclude_urls` → newline/whitespace/comma separated PR URLs to skip.

Auth model:
- Prefer `${{ secrets.PR_REAPER_TOKEN }}` as `GH_TOKEN`; ensure it carries `repo` + `read:org`.
- Fallback to `GITHUB_TOKEN`; restrict expectations to the current repo when scopes are limited.
- Surface early failures for missing `repo`; warn when `read:org` is required but absent.

REFACTORS:
- Create `src/inputs.ts` for upfront validation (types, ranges, auth requirements) and typed config.
- Emit two dry-run artifacts: human-readable Markdown/CSV summary and machine-readable `prs.json`.
- Split runtime into `src/reap.ts` (orchestration), `src/gh.ts` (mockable `gh` wrapper), and thin
  `src/index.ts` entrypoint; isolate shell calls for unit testing.
- Extend tests with negative paths: missing PAT scopes, missing `read:org` when `org` is set, and
  unauthenticated runs.

DOCS:
- Refresh README with a concise inputs/outputs table that lists defaults, examples, and Actions UI
  screenshots.
- Add a "Safety model" section clarifying dry-run guarantees (no closures, no deletions, artifacts
  only) and noting that only authenticated runs mutate PRs.

RELEASE:
- Align semantic tags with `action.yml` metadata updates; verify name/description/branding before
  publishing.
- Confirm the packaged bundle references the compiled TypeScript entrypoint and summarizes changes
  for downstream automation.

MIGRATION:
- Provide `scripts/migrate-prompt-docs.sh` to relocate Codex prompts into `docs/prompts/codex/` and
  rewrite references.
- Open a PR titled "chore: align codex docs under docs/prompts" with body:
  what: move Codex prompt docs under docs/prompts/codex and refresh references
  why: keep prompts co-located for future automation/polish work
  how to test: npm run lint && npm run test:ci

OUTPUT:
- Supply a roadmap summary, implementation checklist, testing plan, doc update outline, and release
  steps aligned with the goals above.
```

## Upgrade Prompt

```
SYSTEM:
You are Codex refining the "Primary Prompt" in docs/prompts/codex/polish.md.

TASK:
1. Review the Primary Prompt for clarity, completeness, and actionable structure.
2. Suggest targeted edits that improve readability, enforce safety constraints, and reduce ambiguity
   while preserving the roadmap content (snapshot, refactors, docs, release, migration).
3. Highlight any missing context needed for Codex to execute confidently.

OUTPUT:
- Return a bullet list of improvements followed by a revised prompt block ready to replace the
  original Primary Prompt.
```
