# PR Reaper

One-button workflow to close all open pull requests authored by you. Designed for sweeping away
orphaned or superseded PRs (e.g., from automated Codex runs) in bulk, with a safe dry-run mode
before reaping begins.

## Auth
Create a fine-grained Personal Access Token and store it as a repo secret named
`PR_REAPER_TOKEN`.

- **Owner**: your user
- **Resource access**: select the orgs/repos you want it to manage
- **Permissions**: Repository → Pull requests: Read/Write, Contents: Read
- If you need to act on private repos across multiple orgs, include those explicitly in the
  token's resource access.

Add it under: Repo → Settings → Secrets and variables → Actions → New repository secret →
`PR_REAPER_TOKEN`.

## Use
1. Go to **Actions → Close my open PRs → Run workflow**.
2. Leave **dry_run=true** to preview.
3. When happy, re-run with **dry_run=false**.
4. Optional inputs:
   - `org`: only PRs in a specific org
   - `title_filter`: only PRs with substring in the title (uses `in:title`)
   - `delete_branch`: also delete the PR source branch
   - `comment`: closing message
