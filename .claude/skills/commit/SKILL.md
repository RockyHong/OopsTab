---
name: commit
description: 'Stage and commit current session changes with a proper conventional commit message. No push.'
tags: [commit, git, pre-commit, commit-message]
---

# Commit

Stage and commit the current session's changes with a well-formed commit message.

## Protocol

1. **Gather state** (parallel):
   - `git status` (never `-uall`)
   - `git diff` + `git diff --staged` to see all changes
   - `git log --oneline -5` for recent commit style

2. **Analyze changes:**
   - Identify what changed and why (new feature, fix, refactor, docs, etc.)
   - Do NOT stage files that look like secrets (`.env`, credentials, keys)
   - Do NOT stage unrelated files that aren't part of the current work

3. **Draft commit message:**
   - One-line summary: `type: concise description` (under 72 chars)
   - Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`
   - Optional body: explain "why" not "what" — the diff shows the what
   - No `Co-Authored-By` trailer

4. **Stage + commit** (sequential):
   - `git add` specific files (not `git add .` or `git add -A`)
   - Commit using HEREDOC for message formatting
   - Run `git status` after to verify

5. **Report:** Show the commit hash and summary. Do NOT push.

## Rules

- Never `cd` — working directory is already correct.
- Never push. Pushing is the user's responsibility.
- Never amend previous commits unless explicitly asked.
- Never use `--no-verify` or skip hooks.
- If nothing to commit, say so and stop.
- Use built-in tools (Read, Grep, Glob) over bash equivalents where possible.
