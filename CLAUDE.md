## Git workflow

Before beginning any development task, check the
current Git status and create a new branch from
`main` unless the user says otherwise.

Use short, descriptive branch names with these prefixes:

- `feature/` for new functionality
- `fix/` for bug fixes
- `docs/` for documentation-only changes
- `test/` for test-only changes
- `refactor/` for internal code changes that do
  not change behavior
- `chore/` for maintenance tasks

Use lowercase words separated by hyphens. For
example:

- `feature/add-search-page`
- `fix/checkout-total`
- `docs/update-readme`
- `test/add-login-tests`

Before creating a branch, confirm that the working
tree is clean or explain any uncommitted changes.

## Committing

- Make small, focused commits that each do one
  thing. Don't mix refactoring, formatting, and
  behavior changes in the same commit.
- Before committing, run `git status` and
  `git diff --staged` to check exactly what will
  be included.
- Stage files by name (`git add path/to/file`).
  Avoid `git add -A` and `git add .` so unrelated
  or generated files aren't swept in.
- Never commit secrets, credentials, `.env` files,
  private keys, or build output. If one is staged,
  unstage it and tell the user.
- Write commit messages with a short imperative
  summary line (about 50 characters, e.g.
  "Add search page"), a blank line, and then a body
  explaining *why* the change was made when it is
  not obvious.
- Run the project's tests and linters before
  committing when they exist. If they fail, say so
  instead of committing around them.
- Don't use `--no-verify` to skip hooks. If a hook
  fails, fix the underlying problem.
- Create a new commit rather than amending, unless
  the user asks to amend. Never amend a commit that
  has already been pushed.

## Pushing and sharing

- Never commit directly to `main`. All changes go
  through a branch.
- Ask before pushing, and push only the current
  feature branch
  (`git push -u origin <branch-name>`).
- Never force-push. If a push is rejected, fetch
  and explain the divergence to the user instead
  of overwriting the remote.
- Don't open, merge, or close pull requests unless
  the user asks.

## Destructive and history-changing commands

These can permanently lose work. Don't run them
unless the user explicitly asks, and describe what
will be lost first:

- `git reset --hard`, `git checkout -- <path>`,
  `git restore <path>` (discard uncommitted changes)
- `git clean -f` (deletes untracked files)
- `git branch -D` (deletes unmerged branches)
- `git stash drop` / `git stash clear`
- `git rebase`, `git commit --amend`, and
  `git filter-branch` on commits that have been
  pushed

When unsure, make a safety net first: stash changes
or create a backup branch
(`git branch backup/<name>`).

## Staying in sync

- Run `git fetch` before starting work on a branch
  to see whether `main` has moved.
- If you hit merge conflicts, stop and show the
  user the conflicting files. Don't resolve
  non-trivial conflicts by guessing, and never
  resolve them by discarding one side wholesale.

## Working efficiently

- Prefer read-only commands (`git status`,
  `git diff`, `git log --oneline`, `git show`) to
  understand the state of the repo before acting.
- Use non-interactive forms of commands. Interactive
  flags such as `git rebase -i` and `git add -p`
  aren't supported.
- Use `git log --oneline -n 20` and
  `git diff --stat` for quick summaries rather than
  dumping full history or large diffs.
- For parallel or experimental work, use
  `git worktree` so the main checkout isn't
  disturbed.
