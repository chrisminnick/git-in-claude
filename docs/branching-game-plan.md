# Branch Out: a Git branching game (design plan)

Status: design only. Nothing in this document has been built yet.

## Goal and audience

*Branch Out* is a short browser puzzle game for Git beginners. By the end, a player
should understand that:

- A commit records a snapshot and points back to its parent commit or commits.
- A branch is a movable label that points to one commit.
- `HEAD` shows where you are: usually on a branch, and new commits move that branch
  forward.
- Merging either moves a label forward (a fast-forward) or creates a commit with two
  parents (a three-way merge).

The game lives next to `docs/index.html` and is linked from it, so it's served by GitHub
Pages along with the rest of the site. It also reinforces the branch-first workflow in
this repo's `CLAUDE.md`.

## Core loop

1. A level opens with a one-sentence concept intro and a **goal graph**.
2. The player's **current graph** is on the left, and the goal graph is on the right.
3. The player types Git commands into a terminal-style input below the graphs.
4. After each command, the current graph animates to its new state, and a short line of
   output appears in the terminal, as real Git would print.
5. When the current graph matches the goal, the level is solved. A short explanation
   appears, along with the player's command count compared with par.

**Matching rule:** two graphs match when they have the same commit structure (parent
relationships), the same branch names pointing at corresponding commits, and the same
`HEAD`. Commit IDs and the order commits were made in are ignored, so any valid solution
counts.

## Supported commands

The game simulates a small subset of Git. It doesn't run real Git.

| Command | Behavior |
| --- | --- |
| `git commit` (with or without `-m "..."`) | Adds a commit whose parent is the current commit, and moves the current branch to it. |
| `git branch` | Lists branches and marks the current one. |
| `git branch <name>` | Creates a branch at the current commit. `HEAD` doesn't move. |
| `git branch -d <name>` | Deletes a branch only if it has been merged into the current branch. Refuses with Git's real error message otherwise. |
| `git switch <name>` / `git checkout <name>` | Moves `HEAD` to that branch. |
| `git switch -c <name>` / `git checkout -b <name>` | Creates a branch and switches to it. |
| `git merge <name>` | Fast-forwards when possible. Otherwise creates a merge commit with two parents. |
| `git log --oneline` | Prints the history reachable from `HEAD`. |
| `git status` | Prints `On branch <name>`. |
| `hint` | Shows the level's hint. |
| `undo` | Reverts the last command. |
| `reset` | Restarts the level. This is a game command, not `git reset`. |

Anything else gets a friendly message: "That command isn't part of this game. Try
`hint`." Invalid branch names and switching to a missing branch get errors worded like
real Git's.

## Levels

| # | Title | Start state | Goal | Teaches | Par |
| --- | --- | --- | --- | --- | --- |
| 1 | First commits | One commit on `main` | Three commits on `main` | Commits form a chain, and the branch moves along with them | 2 |
| 2 | Make a branch | Two commits on `main` | `feature` points at the same commit, with `HEAD` still on `main` | `git branch` creates a label but doesn't move you | 1 |
| 3 | Go there and commit | Level 2's goal | One new commit on `feature`, with `HEAD` on `feature` | Switching changes which label moves | 2 |
| 4 | Diverge | `main` and `feature` at the same commit | One new commit on each branch | Branches can split | 3 |
| 5 | Fast-forward | `feature` is two commits ahead of `main` | `main` and `feature` at the same commit | A merge with no new work on the target just moves the label | 2 |
| 6 | Real merge | Level 4's goal | A merge commit on `main` with two parents | A three-way merge | 2 |
| 7 | Tidy up | A merged `feature` and an unmerged `experiment` | `feature` deleted, `experiment` kept | `-d` deletes only merged branches | 1 |
| 8 | The house workflow | One commit on `main` | Branch `feature/add-search-page` with two commits, merged into `main`, then deleted | The `CLAUDE.md` workflow from start to finish | 6 |

In level 7, the explanation for the `-d` refusal teaches why Git protects unmerged work.
It links to the "Destructive and history-changing commands" section of `CLAUDE.md`.

## Teaching aids

- **Concept intro:** one sentence per level, shown above the graphs.
- **Hint:** one hint per level, available through the `hint` command or a button.
- **Explanation on success:** two or three sentences about what just happened and why.
- **Visual emphasis:** branch labels are colored tags, and `HEAD` is a distinct marker
  attached to the current branch. The commit that changed in the last step pulses
  briefly.
- **Common-mistake nudges:** if the player commits on the wrong branch, such as on
  `main` when the goal needs the commit on `feature`, the game shows a hint pointing
  to `git switch` without failing the level.

## Technical design

- **Static files:** `docs/branching-game.html` (markup, inline CSS, and the UI code)
  plus `docs/branching-game.js`, an ES module with the game logic that the page
  imports. They need no build step and no dependencies, so they work on GitHub Pages
  as is, and the logic can be unit tested in Node.
- **Look and feel:** reuse the `:root` color tokens and the
  `prefers-color-scheme: dark` handling from `docs/index.html`, with an explicit `body`
  background and a 16px side gutter on mobile.
- **Model:**

  ```js
  // state
  {
    commits: { c1: { parents: [] }, c2: { parents: ["c1"] } },
    branches: { main: "c2", feature: "c1" },
    head: { branch: "main" }   // or { commit: "c1" } for a detached HEAD, which is a future feature
  }
  ```

- **Pure functions:**
  - `parse(input)` returns a command object or an error.
  - `apply(state, cmd)` returns `{ state, output }` or `{ error }`. It never mutates
    its input, which makes `undo` a simple history stack.
  - `matches(state, goal)` returns a boolean. It canonicalizes both graphs by walking
    from the branch tips, so commit IDs don't matter.
  - `isMerged(state, branch)` is used by `branch -d`.
- **Rendering:** inline SVG. Each branch gets a lane (columns run left to right in
  commit order). Commits are circles, parent links are lines, and branch labels and
  `HEAD` are tags. The SVG is rerendered from state after each command, with a CSS
  transition on positions.
- **Levels:** a `LEVELS` array of `{ id, title, intro, start, goal, hint, explanation, par }`,
  exported from the module.
- **Progress:** completed levels and best command counts are saved in `localStorage`
  under one key. Every read and write is wrapped in try/catch, and the game works
  without storage.

## Accessibility and layout

- The command input has focus on load. Up and down arrows recall previous commands,
  and `Enter` runs the current one.
- Each graph has a text description for screen readers (for example, "main points to
  commit 3; feature points to commit 2; HEAD is on main"), updated in an
  `aria-live` region.
- Branch colors are paired with text labels, so color is never the only signal.
- At phone width, the goal graph stacks above the current graph, and the terminal
  stays full width with no horizontal page scroll.

## Out of scope for v1

These are listed as future levels:

- Detached `HEAD` (`git switch --detach`, checking out a commit directly)
- `git rebase`
- Remotes: `fetch`, `pull`, `push`, and tracking branches
- Merge conflicts
- `git reset` and `git revert`

## Testing plan for the build

- **Unit tests:** `docs/branching-game.test.mjs`, run with `node --test`, for `parse`,
  `apply` (each command, plus error cases), `matches` (same structure with different
  IDs), and `isMerged`, imported from `docs/branching-game.js`.
- **Level solvability:** a test applies each level's reference solution and asserts
  that it matches the goal within par.
- **Manual pass:** play every level in light and dark mode, at desktop and phone
  widths, using only the keyboard.

## Open questions

- Should commits show realistic short SHAs (`a1b2c3d`) or simple labels (`C1`, `C2`)?
  Simple labels are easier to talk about in class.
- Should the README link to the game, or only `docs/index.html`?
- Is a par command count motivating or distracting for beginners?
