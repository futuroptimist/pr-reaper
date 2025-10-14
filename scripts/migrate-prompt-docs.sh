#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "This script requires git on PATH." >&2
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel)"
TARGET_DIR="${ROOT}/docs/prompts/codex"
mkdir -p "${TARGET_DIR}"

move_file() {
  local src="$1"
  local dest="$2"
  local src_path="${ROOT}/${src}"
  local dest_path="${ROOT}/${dest}"

  if [ ! -e "${src_path}" ]; then
    return
  fi

  mkdir -p "$(dirname "${dest_path}")"

  if git ls-files --error-unmatch "${src}" >/dev/null 2>&1; then
    echo "git mv ${src} ${dest}"
    git mv "${src}" "${dest}"
  else
    echo "mv ${src_path} ${dest_path}"
    mv "${src_path}" "${dest_path}"
  fi
}

# Move legacy files into docs/prompts/codex/
move_file "docs/codex-custom-instructions.md" "docs/prompts/codex/custom-instructions.md"
move_file "docs/codex-automation.md" "docs/prompts/codex/automation.md"
move_file "docs/codex-polish.md" "docs/prompts/codex/polish.md"

# Move entire docs/codex directory if it exists
if [ -d "${ROOT}/docs/codex" ]; then
  find "${ROOT}/docs/codex" -maxdepth 1 -type f -name '*.md' -print0 | while IFS= read -r -d '' file; do
    filename="$(basename "${file}")"
    move_file "docs/codex/${filename}" "docs/prompts/codex/${filename}"
  done
  if [ -d "${ROOT}/docs/codex" ] && [ -z "$(ls -A "${ROOT}/docs/codex")" ]; then
    rmdir "${ROOT}/docs/codex"
  fi
fi

# Update references in tracked files.
python3 - <<'PY'
import pathlib
import re

ROOT = pathlib.Path('.').resolve()
PATTERNS = {
    r'docs/codex-custom-instructions\.md': 'docs/prompts/codex/custom-instructions.md',
    r'docs/codex-automation\.md': 'docs/prompts/codex/automation.md',
    r'docs/codex-polish\.md': 'docs/prompts/codex/polish.md',
    r'docs/codex/': 'docs/prompts/codex/',
}

for path in ROOT.rglob('*'):
    if not path.is_file():
        continue
    if path.suffix not in {'.md', '.txt', '.yml', '.yaml'}:
        continue
    text = path.read_text()
    updated = text
    for old, new in PATTERNS.items():
        updated = re.sub(old, new, updated)
    if updated != text:
        path.write_text(updated)
PY

LLMS_FILE="${ROOT}/llms.txt"
if [ -f "${LLMS_FILE}" ]; then
  python3 - "${LLMS_FILE}" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
original = path.read_text()
updated = original.replace(
    '[codex-custom-instructions.md](docs/codex-custom-instructions.md)',
    '[custom-instructions.md](docs/prompts/codex/custom-instructions.md)',
)
if updated != original:
    path.write_text(updated)
PY
fi

echo "Migration complete. Review changes with 'git status'."
