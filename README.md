# git-in-claude

A demo repository for teaching Git with [Claude Code](https://claude.com/claude-code).
It exists to be cloned, broken, branched, and reset — a safe sandbox where students
can practice Git operations by asking Claude Code to perform them, and see what
actually happens to the repo.

## Getting started

```bash
git clone https://github.com/chrisminnick/git-in-claude.git
cd git-in-claude
claude
```

From there, drive Git through Claude Code in plain language — "create a branch for
the login feature," "show me what changed," "undo my last commit but keep the
changes" — and inspect the result with ordinary Git commands.

## Suggested exercises

- Inspect state: status, log, and diff, and what each one actually tells you.
- Branch and merge, then create a merge conflict on purpose and resolve it.
- Undo work three ways: `git restore`, `git reset`, and `git revert`.
- Rewrite history on a throwaway branch: amend, squash, and interactive rebase.
- Work with remotes: fetch vs. pull, and pushing a branch for review.

Because this repo is disposable, the fastest fix for any mess is to delete your
clone and start over.

## Contributing

Additional exercises and corrections are welcome. Open an issue to propose a new
exercise, or send a pull request against `main`.

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 Chris Minnick.
