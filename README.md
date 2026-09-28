# git-in-claude

A starting point for new projects that use Git with
[Claude Code](https://claude.com/claude-code). It shows best practices for working with
Git alongside Claude and includes safeguards that keep Claude from losing work, rewriting
shared history, or leaking secrets.

This repo was created by Chris Minnick ([chris@minnick.com](mailto:chris@minnick.com))
for Chapter 9 of *Claude Code For Dummies* (Wiley). See that chapter for more
information about the repo and how to use it.

You can use it three ways:

- **As a template** for a new project, so the Git workflow and safeguards are in place
  from the first commit.
- **As a reference** to copy into an existing repository.
- **As a sandbox** for practicing Git operations with Claude Code and seeing what
  actually happens to the repo.

## What's included

| File | Purpose |
| --- | --- |
| `CLAUDE.md` | Workflow guidance Claude Code reads at the start of every session: branch naming, commit hygiene, rules for pushing, which commands are destructive, handling conflicts, and keeping Git output concise. |
| `.claude/settings.json` | Project permission rules that enforce the most important parts of that guidance. |
| `.gitignore` | Ignores common build output, caches, editor files, and secrets such as `.env` and `*.pem`. |

### Safeguards in `.claude/settings.json`

The permission rules fall into three tiers. When rules overlap, `deny` wins over `ask`,
and `ask` wins over `allow`.

- **Allow (no prompt):** read-only commands (`status`, `diff`, `log`, `show`, `blame`,
  `fetch`, and listing branches and remotes), plus creating a branch, staging, and
  committing. These are local and easy to undo.
- **Ask (always prompts):** anything that shares work or changes history, such as
  `push`, `pull`, `merge`, `rebase`, `reset`, `restore`, `checkout`, dropping stashes,
  deleting branches, `commit --amend`, and `gh pr`.
- **Deny (blocked):** force pushes, direct pushes to `main`, `reset --hard`,
  `clean -f`, `filter-branch`, skipping hooks with `--no-verify`, changing global Git
  config, and reading `.env*`, `*.pem`, and bulky `.git` internals.

These rules match the start of the command text, so they reduce risk but aren't
airtight. For example, a command with its flags in an unexpected order can slip past a
pattern. The guidance in `CLAUDE.md` covers those gaps in practice. For real
enforcement, also turn on branch protection for `main` on your Git host.

## Start a new project from this repo

```bash
git clone https://github.com/chrisminnick/git-in-claude.git my-project
cd my-project
rm -rf .git
git init -b main
```

Then:

1. Replace this README with one for your project, and update or replace `LICENSE`.
2. Add your project's own conventions (build and test commands, code style) to
   `CLAUDE.md` alongside the Git sections.
3. Make your first commit and push it:

   ```bash
   git add .
   git commit -m "Initial commit from git-in-claude template"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

4. Turn on branch protection for `main` so all later changes arrive through branches
   and pull requests.

## Add these practices to an existing repository

1. **Create a branch** for the change:

   ```bash
   git switch -c chore/add-claude-git-safeguards
   ```

2. **Add the workflow guidance.** If your repo has no `CLAUDE.md`, copy this one in.
   If it already has one, append the Git sections from this repo's `CLAUDE.md` and
   adjust anything that conflicts with your team's conventions, such as branch
   prefixes or whether Claude may commit without asking.

3. **Add the permission rules.** If your repo has no `.claude/settings.json`, copy
   this one in. If it already has one, merge the `allow`, `ask`, and `deny` arrays
   instead of overwriting the file. You can ask Claude Code to do it: *"Merge the
   permission rules from ../git-in-claude/.claude/settings.json into
   .claude/settings.json without removing any existing rules."* Check that the result
   is still valid JSON:

   ```bash
   python3 -m json.tool .claude/settings.json > /dev/null && echo valid
   ```

4. **Check the `.gitignore`.** Make sure secrets (`.env`, private keys) and build output
   are ignored, borrowing entries from this repo's `.gitignore` as needed.

5. **Verify** by starting `claude` in the repo and running `/permissions` to see the
   active rules. Try a safe command like "show me git status" (it should run without a
   prompt) and a risky one like "force-push this branch" (it should be refused).

6. **Commit the files and open a pull request** so your team can review the rules
   before they apply to everyone.

### Choosing where the rules live

- `.claude/settings.json` is committed and applies to everyone who works in the repo.
  Use it for team-wide safeguards.
- `.claude/settings.local.json` is for personal overrides in one repo. Keep it out of
  version control.
- `~/.claude/settings.json` applies to every project on your machine. It's a good
  place for the `deny` rules if you want them everywhere.

## Practicing Git with Claude Code

To use this repo as a sandbox, clone it and start Claude Code:

```bash
git clone https://github.com/chrisminnick/git-in-claude.git
cd git-in-claude
claude
```

From there, drive Git through Claude Code in plain language — "create a branch for
the login feature," "show me what changed," "undo my last commit but keep the
changes" — and inspect the result with ordinary Git commands.

### Suggested exercises

- Inspect state: status, log, and diff, and what each one actually tells you.
- Branch and merge, then create a merge conflict on purpose and resolve it.
- Undo work three ways: `git restore`, `git reset`, and `git revert`.
- Rewrite history on a throwaway branch: amend, squash, and interactive rebase.
- Work with remotes: fetch vs. pull, and pushing a branch for review.

The safeguards are active while you practice, so some of these operations will prompt
for approval or be refused. That's part of the lesson: watch which commands Claude
treats as risky, and why. Claude Code can't run interactive commands such as
`git rebase -i`, so run those yourself in a terminal.

Because a practice clone is disposable, the fastest fix for any mess is to delete it
and start over.

## Contributing

Additional exercises, safeguards, and corrections are welcome. Open an issue to propose
a change, or send a pull request against `main`.

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 Chris Minnick.
