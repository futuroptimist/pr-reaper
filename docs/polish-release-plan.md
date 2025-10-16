# PR Reaper polish release plan

## Roadmap summary
- Short-term: land the refactored action with enhanced input validation, gh wrapper abstractions,
  and dry-run artifact exports while keeping the workflow dispatch UX stable.
- Mid-term: socialize the migration script and updated documentation so downstream Codex automations
  adopt the new prompts layout.
- Long-term: monitor adoption metrics, collect feedback on the safety model, and iterate on
  additional filters or reporting integrations without breaking the current interface.

## Implementation checklist
- [x] Validate workflow inputs up front with typed configuration and actionable errors.
- [x] Guard authentication early, surfacing missing `repo` or `read:org` scopes before performing
  searches.
- [x] Produce Markdown, CSV, and JSON dry-run artifacts for both human and automation review.
- [x] Split the runtime into `inputs`, `gh`, and `reap` modules with unit-testable seams.
- [x] Ensure migration script moves Codex prompt docs into `docs/prompts/codex/` and rewrites
  references.

## Testing plan
- `npm run lint` to enforce static typing across the refactored modules.
- `npm run test:ci` to execute the expanded unit test suite, including negative authentication paths
  and workflow contract checks.
- Manual verification that dry-run artifacts appear in the workspace during tests via the stubbed
  artifact client.

## Documentation update outline
- Refresh README inputs/outputs table and embed the Actions run screenshot.
- Document the dry-run safety model, token requirements, and emitted artifacts.
- Add the polish release plan (this document) to guide maintainers and automation users through
  adoption.
- Point migration consumers to `scripts/migrate-prompt-docs.sh` for prompt doc relocation.

## Release steps
- Bump the packaged bundle (`dist/`) after running `npm run build` to sync with the latest
  TypeScript sources.
- Verify `action.yml` metadata (name, description, branding) aligns with the planned semantic
  release tag.
- Run `npm run lint` and `npm run test:ci`; ensure CI mirrors these checks before publishing.
- Draft release notes summarizing refactors, artifacts, documentation, and migration guidance for
  downstream tooling.
- Publish the GitHub Action release and open the migration PR titled "chore: align codex docs under
  docs/prompts" using the provided template.
