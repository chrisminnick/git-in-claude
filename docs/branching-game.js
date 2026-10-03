// Game logic for Branch Out, a Git branching puzzle game.
// A plain script (not an ES module) so docs/branching-game.html works when opened
// straight from disk. In the browser it sets window.BranchOut; in Node it exports the
// same API for the tests in branching-game.test.mjs.
(function () {
  'use strict';

  // State shape:
  // {
  //   commits: { C1: { parents: [], message: 'Initial commit' }, ... },
  //   branches: { main: 'C1', ... },
  //   head: 'main',   // the current branch; null in a goal means "any branch"
  //   nextId: 2       // the next commit is labeled C2
  // }

  const DEFAULT_MESSAGES = [
    'Initial commit', 'Add home page', 'Add styles', 'Fix typo', 'Add about page',
    'Update README', 'Add search box', 'Refactor header', 'Add footer', 'Fix layout',
  ];

  const UNSUPPORTED = "That command isn't part of this game. Type hint for help.";

  const num = (id) => Number(id.slice(1));

  function defaultMessage(id) {
    return DEFAULT_MESSAGES[(num(id) - 1) % DEFAULT_MESSAGES.length];
  }

  // Builds a state from { id: parents[] } (or { id: { parents, message } }).
  function makeState(commitSpec, branches, head) {
    const commits = {};
    for (const [id, spec] of Object.entries(commitSpec)) {
      const parents = Array.isArray(spec) ? spec : spec.parents;
      const message = (!Array.isArray(spec) && spec.message) || defaultMessage(id);
      commits[id] = { parents: [...parents], message };
    }
    const nextId = Math.max(0, ...Object.keys(commits).map(num)) + 1;
    return { commits, branches: { ...branches }, head, nextId };
  }

  function clone(state) {
    const commits = {};
    for (const [id, c] of Object.entries(state.commits)) {
      commits[id] = { parents: [...c.parents], message: c.message };
    }
    return { commits, branches: { ...state.branches }, head: state.head, nextId: state.nextId };
  }

  // --- Parsing ---

  // Splits on whitespace, keeping quoted strings together.
  function tokenize(input) {
    const tokens = [];
    const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
    let m;
    while ((m = re.exec(input)) !== null) {
      tokens.push(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
    }
    return tokens;
  }

  function parse(input) {
    const tokens = tokenize(input.trim());
    if (tokens.length === 1 && ['hint', 'undo', 'reset'].includes(tokens[0])) {
      return { name: tokens[0] };
    }
    if (tokens[0] !== 'git' || tokens.length < 2) return { error: UNSUPPORTED };

    const [, sub, ...args] = tokens;
    const isName = (t) => t !== undefined && !t.startsWith('-');

    switch (sub) {
      case 'commit':
        if (args.length === 0) return { name: 'commit' };
        if (args[0] === '-m' && args.length === 2) return { name: 'commit', message: args[1] };
        if (args[0] === '-m' && args.length === 1) return { error: "error: switch `m' requires a value" };
        return { error: UNSUPPORTED };

      case 'branch':
        if (args.length === 0) return { name: 'branch-list' };
        if (args.length === 1 && isName(args[0])) return { name: 'branch-create', branch: args[0] };
        if (args[0] === '-d' && args.length === 1) return { error: 'fatal: branch name required' };
        if (args[0] === '-d' && args.length === 2) return { name: 'branch-delete', branch: args[1] };
        return { error: UNSUPPORTED };

      case 'switch':
      case 'checkout': {
        const createFlag = sub === 'switch' ? '-c' : '-b';
        if (args.length === 0) return { error: 'fatal: missing branch name' };
        if (args.length === 1 && isName(args[0])) {
          return sub === 'switch'
            ? { name: 'switch', branch: args[0] }
            : { name: 'switch', branch: args[0], via: 'checkout' };
        }
        if (args[0] === createFlag && args.length === 1) return { error: `fatal: option '${createFlag}' requires a value` };
        if (args[0] === createFlag && args.length === 2) return { name: 'switch-create', branch: args[1] };
        return { error: UNSUPPORTED };
      }

      case 'merge':
        if (args.length === 0) return { error: 'Which branch? Try git merge <branch>.' };
        if (args.length === 1 && isName(args[0])) return { name: 'merge', branch: args[0] };
        return { error: UNSUPPORTED };

      case 'log':
        if (args.length === 0 || (args.length === 1 && args[0] === '--oneline')) return { name: 'log' };
        return { error: UNSUPPORTED };

      case 'status':
        if (args.length === 0) return { name: 'status' };
        return { error: UNSUPPORTED };

      default:
        return { error: UNSUPPORTED };
    }
  }

  // --- Graph helpers ---

  function ancestors(state, id) {
    const seen = new Set();
    const stack = [id];
    while (stack.length) {
      const c = stack.pop();
      if (seen.has(c)) continue;
      seen.add(c);
      stack.push(...state.commits[c].parents);
    }
    return seen;
  }

  function reachable(state) {
    const all = new Set();
    for (const tip of Object.values(state.branches)) {
      for (const c of ancestors(state, tip)) all.add(c);
    }
    return all;
  }

  function isMerged(state, branch) {
    return ancestors(state, state.branches[state.head]).has(state.branches[branch]);
  }

  function isValidBranchName(name) {
    return /^[A-Za-z0-9._\/-]+$/.test(name)
      && !/^[-\/.]/.test(name)
      && !name.includes('..')
      && !name.includes('//')
      && !/[\/.]$/.test(name)
      && !name.endsWith('.lock');
  }

  // --- Applying commands ---

  const ok = (state, output, changed = true) => ({ state, output, changed });

  function createBranch(state, name) {
    if (state.branches[name] !== undefined) return { error: `fatal: a branch named '${name}' already exists` };
    if (!isValidBranchName(name)) return { error: `fatal: '${name}' is not a valid branch name` };
    const next = clone(state);
    next.branches[name] = state.branches[state.head];
    return { state: next };
  }

  function apply(state, cmd) {
    const current = state.branches[state.head];

    switch (cmd.name) {
      case 'commit': {
        const next = clone(state);
        const id = `C${state.nextId}`;
        const message = cmd.message || defaultMessage(id);
        next.commits[id] = { parents: [current], message };
        next.branches[state.head] = id;
        next.nextId += 1;
        return ok(next, `[${state.head} ${id}] ${message}`);
      }

      case 'branch-list': {
        const lines = Object.keys(state.branches).sort()
          .map((b) => `${b === state.head ? '*' : ' '} ${b}`);
        return ok(state, lines.join('\n'), false);
      }

      case 'branch-create': {
        const result = createBranch(state, cmd.branch);
        return result.error ? result : ok(result.state, '');
      }

      case 'branch-delete': {
        const b = cmd.branch;
        if (state.branches[b] === undefined) return { error: `error: branch '${b}' not found` };
        if (b === state.head) return { error: `error: Cannot delete branch '${b}' checked out at '~/branch-out'` };
        if (!isMerged(state, b)) {
          return {
            error: `error: the branch '${b}' is not fully merged\nhint: If you are sure you want to delete it, run 'git branch -D ${b}'`,
            unmerged: true,
          };
        }
        const next = clone(state);
        delete next.branches[b];
        return ok(next, `Deleted branch ${b} (was ${state.branches[b]}).`);
      }

      case 'switch': {
        const b = cmd.branch;
        if (state.branches[b] === undefined) {
          return {
            error: cmd.via === 'checkout'
              ? `error: pathspec '${b}' did not match any file(s) known to git`
              : `fatal: invalid reference: ${b}`,
          };
        }
        if (b === state.head) return ok(state, `Already on '${b}'`, false);
        const next = clone(state);
        next.head = b;
        return ok(next, `Switched to branch '${b}'`);
      }

      case 'switch-create': {
        const result = createBranch(state, cmd.branch);
        if (result.error) return result;
        result.state.head = cmd.branch;
        return ok(result.state, `Switched to a new branch '${cmd.branch}'`);
      }

      case 'merge': {
        const b = cmd.branch;
        const theirs = state.branches[b];
        if (theirs === undefined) return { error: `merge: ${b} - not something we can merge` };
        if (ancestors(state, current).has(theirs)) return ok(state, 'Already up to date.', false);
        const next = clone(state);
        if (ancestors(state, theirs).has(current)) {
          next.branches[state.head] = theirs;
          return ok(next, `Updating ${current}..${theirs}\nFast-forward`);
        }
        const id = `C${state.nextId}`;
        next.commits[id] = { parents: [current, theirs], message: `Merge branch '${b}'` };
        next.branches[state.head] = id;
        next.nextId += 1;
        return ok(next, "Merge made by the 'ort' strategy.");
      }

      case 'log': {
        const decorations = {};
        for (const [b, tip] of Object.entries(state.branches).sort(([a], [z]) => a.localeCompare(z))) {
          const label = b === state.head ? `HEAD -> ${b}` : b;
          (decorations[tip] = decorations[tip] || []).push(label);
        }
        for (const list of Object.values(decorations)) {
          list.sort((a, z) => (z.startsWith('HEAD') ? 1 : 0) - (a.startsWith('HEAD') ? 1 : 0));
        }
        const lines = [...ancestors(state, current)]
          .sort((a, z) => num(z) - num(a))
          .map((id) => {
            const deco = decorations[id] ? ` (${decorations[id].join(', ')})` : '';
            return `${id}${deco} ${state.commits[id].message}`;
          });
        return ok(state, lines.join('\n'), false);
      }

      case 'status':
        return ok(state, `On branch ${state.head}\nnothing to commit, working tree clean`, false);

      default:
        return { error: UNSUPPORTED };
    }
  }

  // --- Matching ---

  // Relabels reachable commits by a traversal that depends only on graph structure and
  // branch names, so two graphs match exactly when their canonical forms are equal.
  function canonical(state, includeHead) {
    const labels = new Map();
    const visit = (id) => {
      if (labels.has(id)) return;
      labels.set(id, labels.size);
      for (const p of state.commits[id].parents) visit(p);
    };
    const names = Object.keys(state.branches).sort();
    for (const b of names) visit(state.branches[b]);

    const commits = [...labels.entries()]
      .map(([id, label]) => [label, state.commits[id].parents.map((p) => labels.get(p))])
      .sort((a, z) => a[0] - z[0]);
    const branches = names.map((b) => [b, labels.get(state.branches[b])]);
    return JSON.stringify({ commits, branches, head: includeHead ? state.head : null });
  }

  function matches(state, goal) {
    const includeHead = goal.head !== null && goal.head !== undefined;
    return canonical(state, includeHead) === canonical(goal, includeHead);
  }

  // --- Levels ---

  // `used` holds the commands run so far, each with `on` set to the branch HEAD was on.
  function checkLevel(level, state, used) {
    if (!matches(state, level.goal)) return { solved: false };
    for (const req of level.requires || []) {
      const met = used.some((cmd) => Object.entries(req).every(([k, v]) => cmd[k] === v));
      if (!met) return { solved: false, message: level.requireMessage };
    }
    return { solved: true };
  }

  // A hint for a common mistake, or null.
  function nudge(level, stateBefore, cmd) {
    if (cmd.name === 'commit' && level.commitOn && stateBefore.head !== level.commitOn) {
      return `You're committing on ${stateBefore.head}, but this level wants the new commit on `
        + `${level.commitOn}. Try git switch ${level.commitOn} first, or type undo.`;
    }
    return null;
  }

  // --- Description and layout ---

  function describe(state) {
    const count = reachable(state).size;
    const parts = [`${count} ${count === 1 ? 'commit' : 'commits'}.`];
    for (const b of Object.keys(state.branches).sort()) parts.push(`${b} points to ${state.branches[b]}.`);
    if (state.head) parts.push(`HEAD is on ${state.head}.`);
    return parts.join(' ');
  }

  // Columns follow commit order. main gets lane 0; each other branch gets the next lane
  // if its first-parent chain has commits no earlier branch claimed.
  function layout(state) {
    const ids = [...reachable(state)].sort((a, z) => num(a) - num(z));
    const col = Object.fromEntries(ids.map((id, i) => [id, i]));
    const order = Object.keys(state.branches).sort((a, z) => {
      if (a === 'main') return -1;
      if (z === 'main') return 1;
      return num(state.branches[a]) - num(state.branches[z]) || a.localeCompare(z);
    });

    const lane = {};
    let nextLane = 0;
    for (const b of order) {
      let id = state.branches[b];
      let claimed = false;
      while (id && lane[id] === undefined) {
        lane[id] = nextLane;
        claimed = true;
        id = state.commits[id].parents[0];
      }
      if (claimed) nextLane += 1;
    }

    const nodes = ids.map((id) => ({ id, col: col[id], lane: lane[id], message: state.commits[id].message }));
    const edges = [];
    for (const id of ids) {
      for (const p of state.commits[id].parents) edges.push({ from: id, to: p });
    }
    const tags = order.map((b) => ({ branch: b, at: state.branches[b], head: b === state.head }));
    return { nodes, edges, tags, lanes: nextLane };
  }

  // --- Level data ---

  const LEVELS = [
    {
      id: 1,
      title: 'First commits',
      intro: 'A commit is a snapshot of your project. Each commit points back to the one before it, and the main label moves forward to each new commit.',
      note: 'This game labels commits C1, C2, C3 so they are easy to talk about. Real Git names them with SHAs such as a1b2c3d.',
      start: makeState({ C1: [] }, { main: 'C1' }, 'main'),
      goal: makeState({ C1: [], C2: ['C1'], C3: ['C2'] }, { main: 'C3' }, 'main'),
      hint: 'Run git commit twice.',
      explanation: "Each commit's parent is the commit before it, so history forms a chain. main always points to the newest commit on that chain.",
      par: 2,
      solution: ['git commit', 'git commit'],
    },
    {
      id: 2,
      title: 'Make a branch',
      intro: 'A branch is just a label that points at a commit. Creating one is cheap, because no files are copied.',
      start: makeState({ C1: [], C2: ['C1'] }, { main: 'C2' }, 'main'),
      goal: makeState({ C1: [], C2: ['C1'] }, { main: 'C2', feature: 'C2' }, 'main'),
      hint: 'git branch feature creates the label. Watch where HEAD stays.',
      explanation: "git branch made a new label at the current commit, but you're still on main. HEAD shows which branch you're on, and only that branch moves when you commit.",
      par: 1,
      solution: ['git branch feature'],
    },
    {
      id: 3,
      title: 'Go there and commit',
      intro: 'git switch moves HEAD to another branch. New commits then move that branch instead of main.',
      start: makeState({ C1: [], C2: ['C1'] }, { main: 'C2', feature: 'C2' }, 'main'),
      goal: makeState({ C1: [], C2: ['C1'], C3: ['C2'] }, { main: 'C2', feature: 'C3' }, 'feature'),
      hint: 'Switch to feature with git switch feature, then commit.',
      explanation: 'Only the branch HEAD is on moves forward when you commit, so main stayed where it was.',
      par: 2,
      commitOn: 'feature',
      solution: ['git switch feature', 'git commit'],
    },
    {
      id: 4,
      title: 'Diverge',
      intro: 'Two branches can each get new commits. Their histories then split, or diverge.',
      start: makeState({ C1: [], C2: ['C1'] }, { main: 'C2', feature: 'C2' }, 'main'),
      goal: makeState({ C1: [], C2: ['C1'], C3: ['C2'], C4: ['C2'] }, { main: 'C3', feature: 'C4' }, null),
      hint: 'Commit on main, switch to feature, and commit again.',
      explanation: 'main and feature now share C2 as a common ancestor, but each has a commit the other lacks. Combining them takes a real merge, which is level 6.',
      par: 3,
      solution: ['git commit', 'git switch feature', 'git commit'],
    },
    {
      id: 5,
      title: 'Fast-forward',
      intro: "To bring feature's work into main, switch to main and merge feature.",
      start: makeState({ C1: [], C2: ['C1'], C3: ['C2'], C4: ['C3'] }, { main: 'C2', feature: 'C4' }, 'feature'),
      goal: makeState({ C1: [], C2: ['C1'], C3: ['C2'], C4: ['C3'] }, { main: 'C4', feature: 'C4' }, 'main'),
      hint: 'git switch main, then git merge feature.',
      explanation: "main had no new commits of its own, so Git just slid the main label forward to feature's tip. That's a fast-forward: no new commit is needed.",
      par: 2,
      solution: ['git switch main', 'git merge feature'],
    },
    {
      id: 6,
      title: 'Real merge',
      intro: 'When both branches have new commits, merging creates a new commit with two parents.',
      start: makeState({ C1: [], C2: ['C1'], C3: ['C2'], C4: ['C2'] }, { main: 'C3', feature: 'C4' }, 'feature'),
      goal: makeState(
        { C1: [], C2: ['C1'], C3: ['C2'], C4: ['C2'], C5: ['C3', 'C4'] },
        { main: 'C5', feature: 'C4' },
        'main',
      ),
      hint: 'git switch main, then git merge feature.',
      explanation: "The merge commit's first parent is main's old tip, and its second parent is feature's tip. Both lines of history are now part of main.",
      par: 2,
      solution: ['git switch main', 'git merge feature'],
    },
    {
      id: 7,
      title: 'Tidy up',
      intro: 'Once a branch is merged, you can delete its label. Its commits stay in history.',
      start: makeState(
        { C1: [], C2: ['C1'], C3: ['C2'], C4: ['C3'] },
        { main: 'C3', feature: 'C2', experiment: 'C4' },
        'main',
      ),
      goal: makeState({ C1: [], C2: ['C1'], C3: ['C2'], C4: ['C3'] }, { main: 'C3', experiment: 'C4' }, 'main'),
      hint: 'Delete feature with git branch -d feature. Try deleting experiment too, and see what Git says.',
      explanation: 'Deleting feature removed only the label; its commits are still part of main. Git refuses to delete experiment with -d because C4 is not merged anywhere, so deleting it would lose that work.',
      par: 1,
      solution: ['git branch -d feature'],
    },
    {
      id: 8,
      title: 'The house workflow',
      intro: "This repo's CLAUDE.md says never to commit directly to main. Do the whole workflow: create feature/add-search-page, commit twice, merge it into main, and delete the branch.",
      start: makeState({ C1: [] }, { main: 'C1' }, 'main'),
      goal: makeState({ C1: [], C2: ['C1'], C3: ['C2'] }, { main: 'C3' }, 'main'),
      hint: 'git switch -c feature/add-search-page, commit twice, git switch main, git merge feature/add-search-page, then git branch -d feature/add-search-page.',
      explanation: 'That is the full cycle from CLAUDE.md. Because main had no new commits, the merge was a fast-forward, and deleting the merged branch left a clean, linear history.',
      par: 6,
      commitOn: 'feature/add-search-page',
      requires: [
        { name: 'commit', on: 'feature/add-search-page' },
        { name: 'merge', branch: 'feature/add-search-page' },
        { name: 'branch-delete', branch: 'feature/add-search-page' },
      ],
      requireMessage: 'The graph matches, but this level is about the CLAUDE.md workflow: make your commits on feature/add-search-page, merge it into main, then delete it. Type reset to try again.',
      solution: [
        'git switch -c feature/add-search-page',
        'git commit -m "Add search page"',
        'git commit -m "Style search page"',
        'git switch main',
        'git merge feature/add-search-page',
        'git branch -d feature/add-search-page',
      ],
    },
  ];

  const api = { parse, apply, matches, isMerged, checkLevel, nudge, describe, layout, makeState, LEVELS };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.BranchOut = api;
})();
