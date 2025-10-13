# PR Reaper

[![CI][badge-ci]][actions-ci]
[![Close my open PRs][badge-close-prs]][actions-close-prs]
[![License: MIT][badge-license]][license]

One-button workflow to close all open pull requests authored by you. Designed for sweeping away
orphaned or superseded PRs (e.g., from automated Codex runs) in bulk, with a safe dry-run mode
before reaping begins. `gh search prs` powers the lookup so results match what GitHub shows.

## Auth (important)

This workflow uses the GitHub CLI (`gh`). In Actions, `gh` will authenticate as:

- `GH_TOKEN` if set (recommended) — provide a **Personal Access Token (classic)** with `repo` and
  `read:org`, saved as `PR_REAPER_TOKEN`, exported as `GH_TOKEN` in the job. The workflow fails if
  `repo` scope is missing and warns when `read:org` is absent.
- Otherwise, it may fall back to `GITHUB_TOKEN` or be unauthenticated. `GITHUB_TOKEN` is only scoped
  to the current repo, so cross-repo searches will return nothing.

If you provide the `org` input, the token must include `read:org` scope or the workflow will exit
early with an error.

If no token is detected, `gh` cannot determine the current user, or `repo` scope is missing, the
workflow fails early with an error to avoid silently returning zero results.

Tip: The workflow prints `gh auth status` and `gh api user --jq .login` so you can verify which
identity `gh` is using.

## Use
1. Go to **Actions → Close my open PRs → Run workflow**.
2. Leave **dry_run=true** to preview. The run uploads a `dry-run-prs`
   artifact listing matching PRs or a note when none are found.
3. When happy, re-run with **dry_run=false**.
4. Optional inputs:
   - `org`: only PRs in a specific org
   - `title_filter`: only PRs with substring in the title (`gh search prs --search str --match title`)
   - `delete_branch`: also delete the PR source branch (default: true)
   - `comment`: closing message
  - `exclude_urls`: PR references to skip (accepts spaces, commas, semicolons, pipes, or newlines).
    Supports HTML URLs (e.g., `https://github.com/owner/repo/pull/123`), API URLs, or `owner/repo#123`
    shorthands.

## Development

Run the checks locally:

```bash
npm run lint
npm run test:ci
```

CI runs these commands on every push.

## License

Licensed under the [MIT License](LICENSE).

[badge-ci]: https://github.com/futuroptimist/pr-reaper/actions/workflows/ci.yml/badge.svg
[actions-ci]: https://github.com/futuroptimist/pr-reaper/actions/workflows/ci.yml
[badge-close-prs]: https://github.com/futuroptimist/pr-reaper/actions/workflows/close-my-open-prs.yml/badge.svg
[actions-close-prs]: https://github.com/futuroptimist/pr-reaper/actions/workflows/close-my-open-prs.yml
[badge-license]: https://img.shields.io/badge/license-MIT-blue.svg
[license]: #license

