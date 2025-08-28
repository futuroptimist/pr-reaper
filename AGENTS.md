# 🤖 AGENTS

Guidance for LLM-based assistants working in the pr-reaper repository. See
[llms.txt](llms.txt) for a quick orientation summary.

## Project Structure
- `test/` – Node.js tests using the built-in test runner.

## Coding Conventions
- Node 18+, ES modules.
- Keep functions small and name them descriptively.
- Document complex logic with comments.

## Testing Requirements
Run these commands before committing:

```bash
npm run lint
npm run test:ci
```

## Pull Request Guidelines
1. Provide a clear description and reference related issues.
2. Ensure all checks pass.
3. Keep PRs focused on a single concern.

## Programmatic Checks
Execute the following before merging:

```bash
npm run lint
npm run test:ci
git diff --cached | ./scripts/scan-secrets.py
```
