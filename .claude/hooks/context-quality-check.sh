#!/bin/bash
# UserPromptSubmit hook — fires the context-quality reminder once per
# session when total context tokens cross the threshold. Plain stdout on
# exit 0 is appended to Claude's context as a system reminder.
#
# Stdin schema (UserPromptSubmit):
#   { "session_id": "...", "transcript_path": "...", "cwd": "...",
#     "permission_mode": "...", "hook_event_name": "UserPromptSubmit",
#     "prompt": "..." }
#
# Threshold: $CLAUDE_CONTEXT_QUALITY_THRESHOLD (default 200000).
# Marker:    ${TMPDIR:-/tmp}/claude-context-warned-<session_id>
# Reminder:  $(dirname "$0")/context-quality-reminder.txt

set +e

PAYLOAD="$(cat)"
SESSION_ID="$(jq -r '.session_id // empty' <<< "$PAYLOAD")"
TRANSCRIPT="$(jq -r '.transcript_path // empty' <<< "$PAYLOAD")"

# Missing payload fields = no-op. Never crash Claude Code.
[ -z "$SESSION_ID" ] && exit 0
[ -z "$TRANSCRIPT" ] && exit 0
[ ! -f "$TRANSCRIPT" ] && exit 0
command -v jq >/dev/null 2>&1 || exit 0

THRESHOLD="${CLAUDE_CONTEXT_QUALITY_THRESHOLD:-200000}"
MARKER="${TMPDIR:-/tmp}/claude-context-warned-${SESSION_ID}"

# Already warned this session — skip.
[ -f "$MARKER" ] && exit 0

# Last assistant turn's total context = input + cache_read + cache_creation.
# Mirrors templates/statusline-command.sh:88-93. usage is nested under .message.
TOKENS="$(jq -r '
    select(.type=="assistant" and (.message.usage // null) != null) |
    (.message.usage.input_tokens // 0) +
    (.message.usage.cache_read_input_tokens // 0) +
    (.message.usage.cache_creation_input_tokens // 0)
' "$TRANSCRIPT" 2>/dev/null | tail -n 1)"

# No assistant turns yet, or jq parse hiccup — no-op.
[ -z "$TOKENS" ] && exit 0
[[ ! "$TOKENS" =~ ^[0-9]+$ ]] && exit 0

if [ "$TOKENS" -ge "$THRESHOLD" ]; then
    REMINDER_FILE="$(dirname "$0")/context-quality-reminder.txt"
    if [ -f "$REMINDER_FILE" ]; then
        sed -e "s/{{TOKENS}}/${TOKENS}/g" -e "s/{{THRESHOLD}}/${THRESHOLD}/g" "$REMINDER_FILE"
        touch "$MARKER"
    fi
fi

exit 0
