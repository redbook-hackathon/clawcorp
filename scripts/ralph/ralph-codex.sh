#!/usr/bin/env sh

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
NODE_BIN="${RALPH_NODE_BIN:-node}"

exec "$NODE_BIN" "$SCRIPT_DIR/ralph-codex.mjs" "$@"
