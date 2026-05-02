#!/bin/bash
# PreCompact hook — deletes the per-session "warned" marker so the
# context-quality reminder re-arms after a /compact. Reads JSON payload
# from stdin (provided by Claude Code).
#
# Stdin schema (PreCompact):
#   { "session_id": "...", "transcript_path": "...", "cwd": "...",
#     "hook_event_name": "PreCompact", "compaction_trigger": "manual"|"auto" }
#
# Exits 0 unconditionally — the hook never blocks compaction.

PAYLOAD="$(cat)"
SESSION_ID="$(jq -r '.session_id // empty' <<< "$PAYLOAD")"
[ -z "$SESSION_ID" ] && exit 0

rm -f "${TMPDIR:-/tmp}/claude-context-warned-${SESSION_ID}"
exit 0
