---
name: merge
description: 'Absorb one or more feature branches into the base branch. Recommends merge vs rebase per branch. Designed for lazy absorption of parallel Claude session branches.'
tags: [merge, git, pre-merge]
---

# Merge — Branch Absorption

Absorb feature branches into the base branch. Handles single or multiple branches, recommends strategy per branch.

## Protocol

1. **Gather state** (parallel):
   - `git branch --show-current` — identify current branch
   - `git status` — ensure working tree is clean
   - `git branch -v` — list all local branches with last commit
   - `git log --oneline --graph --all --decorate -20` — visual overview

2. **Identify target branches:**
   - If user specified branches: use those
   - If on a feature branch with no args: absorb current branch into base
   - If on base branch with no args: show all feature branches with divergence info and let user pick

3. **For each candidate branch, gather intel** (parallel per branch):
   - `git log --oneline {base}..{branch}` — commits ahead
   - `git log --oneline {branch}..{base}` — commits behind (base moved since branch)
   - `git diff --stat {base}...{branch}` — files changed
   - `git log --oneline {base}..{branch} | wc -l` — commit count

4. **Recommend strategy per branch:**

   | Condition | Strategy | Why |
   |---|---|---|
   | 1 commit, no conflicts | **Rebase + fast-forward** | Clean linear history |
   | 2-3 commits, single logical change | **Rebase + fast-forward** | Still clean enough |
   | Multi-commit, preserving context matters | **Merge --no-ff** | Keeps branch grouping visible |
   | Branch has been pushed/shared | **Merge --no-ff** | Don't rewrite shared history |
   | Conflicts detected | **Merge** (rebase conflicts are harder to resolve) | Safer conflict resolution |

   Present recommendations as a table. Let user override any.

5. **Confirm with user:**
   - Show full plan: branch → strategy → base
   - Wait for confirmation before executing

6. **Execute sequentially** (order matters — earlier merges can cause conflicts in later ones):
   For each branch in confirmed order:
   
   **If rebase strategy:**
   ```
   git rebase {base} {branch}
   git checkout {base}
   git merge {branch} --ff-only
   ```
   
   **If merge strategy:**
   ```
   git checkout {base}
   git merge {branch} --no-ff
   ```
   
   **On conflict:**
   - Stop immediately
   - Report which branch and which files conflict
   - Show `git diff --name-only --diff-filter=U`
   - Ask user: resolve now, skip this branch, or abort remaining?

7. **Post-absorption per branch:**
   - `git log --oneline -3` to show result
   - Ask: delete the absorbed branch? (`git branch -d {branch}`)

8. **Summary:**
   - List all branches absorbed with strategy used
   - List any skipped branches and why
   - Show final `git log --oneline --graph -10`

## Rules

- Never `cd` — working directory is already correct.
- Never push. Pushing is the user's responsibility.
- Never force-merge or skip conflict resolution.
- Never delete branches without asking.
- If working tree is dirty: **stop** — tell user to commit or stash first.
- If on a detached HEAD: **stop** — ask user to checkout a branch.
- Process branches one at a time — a conflict in branch A may affect branch B.
