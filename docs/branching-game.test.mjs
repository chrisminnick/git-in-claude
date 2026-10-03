// Unit tests for the Branch Out game logic. Run with: node --test docs/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import game from './branching-game.js';

const { parse, apply, matches, isMerged, checkLevel, nudge, describe, layout, makeState, LEVELS } = game;

// C1 <- C2 on main, HEAD on main.
const twoOnMain = () => makeState({ C1: [], C2: ['C1'] }, { main: 'C2' }, 'main');

// Applies a list of command strings, failing the test on any error.
function run(state, ...inputs) {
  for (const input of inputs) {
    const cmd = parse(input);
    assert.ok(!cmd.error, `parse error for "${input}": ${cmd.error}`);
    const result = apply(state, cmd);
    assert.ok(!result.error, `apply error for "${input}": ${result.error}`);
    state = result.state;
  }
  return state;
}

// --- makeState ---

test('makeState sets nextId after the highest commit label', () => {
  assert.equal(twoOnMain().nextId, 3);
});

// --- parse ---

test('parse recognizes git commit with and without a message', () => {
  assert.deepEqual(parse('git commit'), { name: 'commit' });
  assert.deepEqual(parse('git commit -m "Add search page"'), { name: 'commit', message: 'Add search page' });
  assert.deepEqual(parse("git commit -m 'Fix it'"), { name: 'commit', message: 'Fix it' });
});

test('parse recognizes branch commands', () => {
  assert.deepEqual(parse('git branch'), { name: 'branch-list' });
  assert.deepEqual(parse('git branch feature'), { name: 'branch-create', branch: 'feature' });
  assert.deepEqual(parse('git branch -d feature'), { name: 'branch-delete', branch: 'feature' });
});

test('parse treats switch and checkout as the same commands', () => {
  assert.deepEqual(parse('git switch feature'), { name: 'switch', branch: 'feature' });
  assert.deepEqual(parse('git checkout feature'), { name: 'switch', branch: 'feature', via: 'checkout' });
  assert.deepEqual(parse('git switch -c feature'), { name: 'switch-create', branch: 'feature' });
  assert.deepEqual(parse('git checkout -b feature'), { name: 'switch-create', branch: 'feature' });
});

test('parse recognizes merge, log, status, and game commands', () => {
  assert.deepEqual(parse('git merge feature'), { name: 'merge', branch: 'feature' });
  assert.deepEqual(parse('git log --oneline'), { name: 'log' });
  assert.deepEqual(parse('git status'), { name: 'status' });
  assert.deepEqual(parse('hint'), { name: 'hint' });
  assert.deepEqual(parse('undo'), { name: 'undo' });
  assert.deepEqual(parse('reset'), { name: 'reset' });
});

test('parse ignores extra whitespace', () => {
  assert.deepEqual(parse('  git   switch   feature  '), { name: 'switch', branch: 'feature' });
});

test('parse rejects commands outside the game', () => {
  assert.match(parse('git rebase main').error, /isn't part of this game/);
  assert.match(parse('ls').error, /isn't part of this game/);
  assert.match(parse('git branch -D feature').error, /isn't part of this game/);
});

test('parse rejects missing branch names', () => {
  assert.ok(parse('git switch').error);
  assert.ok(parse('git merge').error);
  assert.ok(parse('git branch -d').error);
});

// --- apply: commit ---

test('commit adds a child of the current commit and moves the branch', () => {
  const { state, output } = apply(twoOnMain(), parse('git commit -m "Add page"'));
  assert.deepEqual(state.commits.C3.parents, ['C2']);
  assert.equal(state.commits.C3.message, 'Add page');
  assert.equal(state.branches.main, 'C3');
  assert.equal(state.nextId, 4);
  assert.equal(output, '[main C3] Add page');
});

test('commit without a message gets a default message', () => {
  const { state } = apply(twoOnMain(), parse('git commit'));
  assert.ok(state.commits.C3.message.length > 0);
});

test('apply does not mutate its input state', () => {
  const before = twoOnMain();
  const snapshot = JSON.stringify(before);
  apply(before, parse('git commit'));
  apply(before, parse('git branch feature'));
  assert.equal(JSON.stringify(before), snapshot);
});

// --- apply: branch ---

test('branch creates a label at the current commit without moving HEAD', () => {
  const { state, output } = apply(twoOnMain(), parse('git branch feature'));
  assert.equal(state.branches.feature, 'C2');
  assert.equal(state.head, 'main');
  assert.equal(output, '');
});

test('branch refuses a name that already exists', () => {
  const state = run(twoOnMain(), 'git branch feature');
  assert.equal(apply(state, parse('git branch feature')).error, "fatal: a branch named 'feature' already exists");
});

test('branch refuses invalid names', () => {
  for (const bad of ['-x', 'a..b', 'bad/', 'with space', 'x.lock', '/x']) {
    const result = apply(twoOnMain(), { name: 'branch-create', branch: bad });
    assert.equal(result.error, `fatal: '${bad}' is not a valid branch name`, bad);
  }
});

test('branch accepts slash-prefixed names like feature/add-search-page', () => {
  const { state } = apply(twoOnMain(), parse('git branch feature/add-search-page'));
  assert.equal(state.branches['feature/add-search-page'], 'C2');
});

test('branch with no name lists branches and marks the current one', () => {
  const state = run(twoOnMain(), 'git branch feature');
  const { output } = apply(state, parse('git branch'));
  assert.equal(output, '  feature\n* main');
});

// --- apply: switch ---

test('switch moves HEAD to an existing branch', () => {
  const state = run(twoOnMain(), 'git branch feature');
  const { state: next, output } = apply(state, parse('git switch feature'));
  assert.equal(next.head, 'feature');
  assert.equal(output, "Switched to branch 'feature'");
});

test('switch to the current branch says it is already there', () => {
  const { output } = apply(twoOnMain(), parse('git switch main'));
  assert.equal(output, "Already on 'main'");
});

test('switch to a missing branch fails with the Git error', () => {
  assert.equal(apply(twoOnMain(), parse('git switch nope')).error, 'fatal: invalid reference: nope');
  assert.equal(
    apply(twoOnMain(), parse('git checkout nope')).error,
    "error: pathspec 'nope' did not match any file(s) known to git",
  );
});

test('switch -c creates a branch and switches to it', () => {
  const { state, output } = apply(twoOnMain(), parse('git switch -c feature'));
  assert.equal(state.branches.feature, 'C2');
  assert.equal(state.head, 'feature');
  assert.equal(output, "Switched to a new branch 'feature'");
});

test('switch -c refuses an existing branch name', () => {
  assert.equal(apply(twoOnMain(), parse('git switch -c main')).error, "fatal: a branch named 'main' already exists");
});

test('committing after a switch moves the new branch only', () => {
  const state = run(twoOnMain(), 'git switch -c feature', 'git commit');
  assert.equal(state.branches.feature, 'C3');
  assert.equal(state.branches.main, 'C2');
});

// --- apply: merge ---

test('merge fast-forwards when the current branch is behind', () => {
  const state = run(twoOnMain(), 'git switch -c feature', 'git commit', 'git commit', 'git switch main');
  const { state: next, output } = apply(state, parse('git merge feature'));
  assert.equal(next.branches.main, 'C4');
  assert.equal(Object.keys(next.commits).length, 4);
  assert.equal(output, 'Updating C2..C4\nFast-forward');
});

test('merge creates a two-parent commit when branches have diverged', () => {
  const state = run(twoOnMain(), 'git branch feature', 'git commit', 'git switch feature', 'git commit', 'git switch main');
  const { state: next, output } = apply(state, parse('git merge feature'));
  assert.deepEqual(next.commits.C5.parents, ['C3', 'C4']);
  assert.equal(next.commits.C5.message, "Merge branch 'feature'");
  assert.equal(next.branches.main, 'C5');
  assert.equal(next.branches.feature, 'C4');
  assert.equal(output, "Merge made by the 'ort' strategy.");
});

test('merge reports already up to date when there is nothing new', () => {
  const state = run(twoOnMain(), 'git branch feature');
  assert.equal(apply(state, parse('git merge feature')).output, 'Already up to date.');
});

test('merge of a missing branch fails with the Git error', () => {
  assert.equal(apply(twoOnMain(), parse('git merge nope')).error, 'merge: nope - not something we can merge');
});

// --- apply: branch -d and isMerged ---

test('isMerged is true when the branch tip is reachable from HEAD', () => {
  const state = run(twoOnMain(), 'git branch feature', 'git commit');
  assert.equal(isMerged(state, 'feature'), true);
});

test('isMerged is false when the branch has commits HEAD lacks', () => {
  const state = run(twoOnMain(), 'git switch -c feature', 'git commit', 'git switch main');
  assert.equal(isMerged(state, 'feature'), false);
});

test('branch -d deletes a merged branch', () => {
  const state = run(twoOnMain(), 'git branch feature', 'git commit');
  const { state: next, output } = apply(state, parse('git branch -d feature'));
  assert.equal(next.branches.feature, undefined);
  assert.equal(output, 'Deleted branch feature (was C2).');
});

test('branch -d refuses an unmerged branch with the Git error', () => {
  const state = run(twoOnMain(), 'git switch -c feature', 'git commit', 'git switch main');
  const result = apply(state, parse('git branch -d feature'));
  assert.equal(
    result.error,
    "error: the branch 'feature' is not fully merged\nhint: If you are sure you want to delete it, run 'git branch -D feature'",
  );
  assert.equal(result.unmerged, true);
});

test('branch -d refuses the current branch', () => {
  assert.equal(
    apply(twoOnMain(), parse('git branch -d main')).error,
    "error: Cannot delete branch 'main' checked out at '~/branch-out'",
  );
});

test('branch -d of a missing branch fails with the Git error', () => {
  assert.equal(apply(twoOnMain(), parse('git branch -d nope')).error, "error: branch 'nope' not found");
});

// --- apply: log and status ---

test('log --oneline lists commits reachable from HEAD, newest first, with decorations', () => {
  const state = run(twoOnMain(), 'git commit -m "Third"', 'git branch feature');
  const { output } = apply(state, parse('git log --oneline'));
  const lines = output.split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], 'C3 (HEAD -> main, feature) Third');
  assert.match(lines[2], /^C1 /);
});

test('status prints the current branch', () => {
  assert.equal(apply(twoOnMain(), parse('git status')).output, 'On branch main\nnothing to commit, working tree clean');
});

test('read-only commands report that they did not change state', () => {
  assert.equal(apply(twoOnMain(), parse('git status')).changed, false);
  assert.equal(apply(twoOnMain(), parse('git log --oneline')).changed, false);
  assert.equal(apply(twoOnMain(), parse('git branch')).changed, false);
  assert.equal(apply(twoOnMain(), parse('git commit')).changed, true);
});

// --- matches ---

test('matches ignores commit labels', () => {
  const a = makeState({ C1: [], C2: ['C1'] }, { main: 'C2' }, 'main');
  const b = makeState({ C7: [], C9: ['C7'] }, { main: 'C9' }, 'main');
  assert.equal(matches(a, b), true);
});

test('matches requires the same HEAD when the goal sets one', () => {
  const a = makeState({ C1: [] }, { main: 'C1', feature: 'C1' }, 'main');
  const b = makeState({ C1: [] }, { main: 'C1', feature: 'C1' }, 'feature');
  assert.equal(matches(a, b), false);
});

test('matches ignores HEAD when the goal leaves it unset', () => {
  const a = makeState({ C1: [] }, { main: 'C1', feature: 'C1' }, 'feature');
  const goal = makeState({ C1: [] }, { main: 'C1', feature: 'C1' }, null);
  assert.equal(matches(a, goal), true);
});

test('matches distinguishes two branches on one commit from two identical-looking commits', () => {
  const shared = makeState({ C1: [], C2: ['C1'] }, { main: 'C2', feature: 'C2' }, 'main');
  const split = makeState({ C1: [], C2: ['C1'], C3: ['C1'] }, { main: 'C2', feature: 'C3' }, 'main');
  assert.equal(matches(shared, split), false);
});

test('matches distinguishes branch names and parent order', () => {
  const a = makeState({ C1: [] }, { main: 'C1', feature: 'C1' }, 'main');
  const b = makeState({ C1: [] }, { main: 'C1', topic: 'C1' }, 'main');
  assert.equal(matches(a, b), false);

  const base = { C1: [], C2: ['C1'], C3: ['C1'] };
  const m1 = makeState({ ...base, C4: ['C2', 'C3'] }, { main: 'C4', feature: 'C3' }, 'main');
  const m2 = makeState({ ...base, C4: ['C3', 'C2'] }, { main: 'C4', feature: 'C3' }, 'main');
  assert.equal(matches(m1, m2), false);
});

test('matches ignores commits no branch can reach', () => {
  const withOrphan = makeState({ C1: [], C2: ['C1'] }, { main: 'C1' }, 'main');
  const clean = makeState({ C1: [] }, { main: 'C1' }, 'main');
  assert.equal(matches(withOrphan, clean), true);
});

// --- describe and layout ---

test('describe summarizes branches and HEAD for screen readers', () => {
  const state = run(twoOnMain(), 'git branch feature', 'git commit');
  assert.equal(describe(state), '3 commits. feature points to C2. main points to C3. HEAD is on main.');
});

test('layout puts main on lane 0 and a diverged branch on its own lane', () => {
  const state = run(twoOnMain(), 'git branch feature', 'git commit', 'git switch feature', 'git commit');
  const { nodes, edges } = layout(state);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  assert.equal(byId.C3.lane, 0);
  assert.equal(byId.C4.lane, 1);
  assert.ok(byId.C1.col < byId.C2.col && byId.C2.col < byId.C3.col);
  assert.equal(edges.length, 3);
});

test('layout leaves out commits no branch can reach', () => {
  const state = makeState({ C1: [], C2: ['C1'] }, { main: 'C1' }, 'main');
  assert.deepEqual(layout(state).nodes.map((n) => n.id), ['C1']);
});

// --- levels ---

test('there are eight levels with unique ids', () => {
  assert.equal(LEVELS.length, 8);
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, 8);
});

for (const level of LEVELS) {
  test(`level ${level.id} (${level.title}) is solvable within par by its reference solution`, () => {
    assert.equal(checkLevel(level, level.start, []).solved, false, 'start state must not already be solved');
    let state = level.start;
    const used = [];
    for (const input of level.solution) {
      const cmd = parse(input);
      used.push({ ...cmd, on: state.head });
      const result = apply(state, cmd);
      assert.ok(!result.error, `${input}: ${result.error}`);
      state = result.state;
    }
    assert.equal(checkLevel(level, state, used).solved, true);
    assert.ok(level.solution.length <= level.par, `solution uses ${level.solution.length}, par is ${level.par}`);
  });
}

test('level 8 is not solved by committing straight to main', () => {
  const level = LEVELS[7];
  const used = ['git commit', 'git commit'].map((input) => ({ ...parse(input), on: 'main' }));
  const state = run(level.start, 'git commit', 'git commit');
  const result = checkLevel(level, state, used);
  assert.equal(result.solved, false);
  assert.match(result.message, /feature\/add-search-page/);
});

// --- nudge ---

test('nudge warns when committing on a branch the level does not want', () => {
  const level = LEVELS[2]; // Go there and commit
  assert.match(nudge(level, level.start, parse('git commit')), /git switch/);
});

test('nudge stays quiet for a commit on the right branch or a non-commit', () => {
  const level = LEVELS[2];
  const onFeature = run(level.start, 'git switch feature');
  assert.equal(nudge(level, onFeature, parse('git commit')), null);
  assert.equal(nudge(level, level.start, parse('git status')), null);
});
