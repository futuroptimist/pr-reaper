# PR Reaper

One-button workflow to close all open pull requests authored by you. Designed for sweeping away
orphaned or superseded PRs (e.g., from automated Codex runs) in bulk, with a safe dry-run mode
before reaping begins.

## Auth (important)

This workflow uses the GitHub CLI (`gh`). In Actions, `gh` will authenticate as:

- `GH_TOKEN` if set (recommended) — provide a **Personal Access Token (classic)** with `repo` and
  `read:org`, saved as `PR_REAPER_TOKEN`, exported as `GH_TOKEN` in the job.
- Otherwise, it may fall back to `GITHUB_TOKEN` or be unauthenticated. `GITHUB_TOKEN` is only scoped
  to the current repo, so cross-repo searches will return nothing.

Tip: The workflow prints `gh auth status` and `gh api user --jq .login` so you can verify which
identity `gh` is using.

## Use
1. Go to **Actions → Close my open PRs → Run workflow**.
2. Leave **dry_run=true** to preview. The run uploads a `dry-run-prs`
   artifact listing matching PRs or a note when none are found.
3. When happy, re-run with **dry_run=false**.
4. Optional inputs:
   - `org`: only PRs in a specific org
   - `title_filter`: only PRs with substring in the title (uses `in:title`)
   - `delete_branch`: also delete the PR source branch
   - `comment`: closing message
