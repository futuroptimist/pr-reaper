#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "This script requires git on PATH." >&2
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel)"
TARGET_DIR="${ROOT}/docs/prompts/codex"

mkdir -p "${TARGET_DIR}"

# Map of old → new locations (relative to repo root).
while read -r SRC DEST; do
  [ -n "${SRC}" ] || continue
  SRC_PATH="${ROOT}/${SRC}"
  DEST_PATH="${ROOT}/${DEST}"
  if [ ! -e "${SRC_PATH}" ]; then
    continue
  fi

  mkdir -p "$(dirname "${DEST_PATH}")"

  if git ls-files --error-unmatch "${SRC}" >/dev/null 2>&1; then
    echo "git mv ${SRC} ${DEST}"
    git mv "${SRC}" "${DEST}"
  else
    echo "mv ${SRC_PATH} ${DEST_PATH}"
    mv "${SRC_PATH}" "${DEST_PATH}"
  fi

done <<'MAP'
docs/codex-custom-instructions.md docs/prompts/codex/custom-instructions.md
MAP

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
