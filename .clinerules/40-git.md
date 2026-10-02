# 40-git.md: Git Workflow & Worktrees

1. **Config Safety**:
   - Never change `git config user.name` or `user.email`.
   - Use Delta as default git pager (`core.pager = delta`).

2. **Dirty Worktree Protection**:
   - Do NOT revert or discard uncommitted changes in dirty worktree.
   - Run `git diff --check` before commits to ensure zero whitespace / newline defects.

3. **Git Worktree Operations**:
   - For isolated feature branches:
     - `wt-new <branch>` -> creates and checks out branch in adjacent folder.
     - `wt-list` -> lists active worktrees.
     - `wt-remove <path>` -> safely cleans up worktree after merge.
