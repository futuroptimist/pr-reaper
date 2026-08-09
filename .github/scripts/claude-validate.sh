#!/usr/bin/env bash
# Trusted, fixed-operation validation wrapper for the pr-reaper @claude
# workflow. This script is always installed from the pinned workflow ref
# (github.workflow_sha), never from arbitrary pull request content, so it
# stays trustworthy even when the checked-out repository content is
# adversarial. Every operation is a verbatim command this repo already runs
# in real CI (.github/workflows/ci.yml), with no arguments and no shell
# interpolation of caller-provided data.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: claude-validate.sh <operation>

Fixed operations (each takes zero arguments):
  prepare-deps    npm ci
  lint            npm run lint (tsc -p tsconfig.json --noEmit)
  test-ci         npm run test:ci (build + node --test)
  network-probe   Assert no secret-bearing env vars are visible and outbound network is denied.
EOF
}

if [[ "$#" -ne 1 ]]; then
  usage >&2
  exit 64
fi

op="$1"

case "$op" in
  prepare-deps)
    npm ci
    ;;
  lint)
    npm run lint
    ;;
  test-ci)
    npm run test:ci
    ;;
  network-probe)
    node -e '
      const net = require("net");
      const markers = ["TOKEN", "SECRET", "OIDC", "ACTIONS_ID_TOKEN", "GITHUB_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN"];
      const leaked = Object.keys(process.env).filter((name) =>
        markers.some((marker) => name.toUpperCase().includes(marker))
      );
      if (leaked.length > 0) {
        console.error("secret-bearing environment variables visible: " + leaked.sort().join(","));
        process.exit(1);
      }
      const socket = net.connect({ host: "1.1.1.1", port: 443, timeout: 2000 });
      socket.on("connect", () => {
        console.error("outbound network unexpectedly reachable");
        socket.destroy();
        process.exit(1);
      });
      socket.on("error", () => process.exit(0));
      socket.on("timeout", () => {
        socket.destroy();
        process.exit(0);
      });
    '
    ;;
  *)
    echo "Unknown operation: $op" >&2
    usage >&2
    exit 64
    ;;
esac
