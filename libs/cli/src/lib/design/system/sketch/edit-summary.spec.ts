import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { shownSketchRowsOf } from '../../sketch-frame-set';
import { commitAll, git, initGitRepo } from '../git-repo.fixtures';
import { editCommitsOf, editNoteOf, editStatesOf, withEditUnchanged } from './edit-summary';
import { Sketch } from './sketch';

const PART = 'elements/variant-cell';
const SHARED = ['changed', 'unchanged', 'same-as-rest', 'loading', 'loading-small', 'cropped', 'stacked', 'pinned'];

const variantCellTargets = () => [
  { part: PART, variant: 'new', states: SHARED, unchanged: [] as string[], changes: { added: [], dropped: [] } },
  {
    part: PART,
    variant: 'old',
    states: [...SHARED.slice(0, 5), 'selected', ...SHARED.slice(5)],
    unchanged: SHARED,
    changes: { added: ['selected'], dropped: [] },
  },
];

const editSketch = { target: `${PART}@edit`, layer: 'elements', name: 'variant-cell' } as Sketch;

const rowsOf = (targets: ReturnType<typeof variantCellTargets>) =>
  targets.map((entry) => ({
    key: entry.variant,
    shots: entry.states.map((state) => ({ state, changed: !entry.unchanged.includes(state) })),
  }));

describe('withEditUnchanged', () => {
  it('folds the states old and new of variant-cell@edit draw alike, leaving the dropped selected', () => {
    const shown = shownSketchRowsOf({ listed: rowsOf(withEditUnchanged(editSketch, variantCellTargets())) });

    expect(shown.map((row) => [row.key, row.shots.map((shot) => shot.state)])).toEqual([
      ['new', []],
      ['old', ['selected']],
    ]);
  });

  it('leaves the targets of any other sketch as they are', () => {
    const targets = variantCellTargets();
    const sketch = { ...editSketch, target: `${PART}@other` } as Sketch;

    expect(withEditUnchanged(sketch, targets)).toBe(targets);
  });
});

describe('editStatesOf', () => {
  it('names selected as removed by the new of variant-cell@edit', () => {
    expect(editStatesOf(variantCellTargets(), PART)).toEqual({ removed: ['selected'], added: [], redrawn: [] });
  });

  it('names a state both draw differently as redrawn', () => {
    const targets = variantCellTargets();
    const old = targets[1];

    if (old) old.unchanged = SHARED.filter((state) => state !== 'pinned');

    expect(editStatesOf(targets, PART).redrawn).toEqual(['pinned']);
  });
});

describe('editNoteOf', () => {
  it('names the commit and the differing states', () => {
    expect(
      editNoteOf({
        note: 'die Änderung außerhalb eines Sketches',
        commits: [{ hash: 'e9b96c84d', subject: 'fix(repo): Drop the selection ring' }],
        states: { removed: ['selected'], added: [], redrawn: [] },
      }),
    ).toBe(
      'die Änderung außerhalb eines Sketches: e9b96c84d fix(repo): Drop the selection ring · Unterschied: selected entfernt',
    );
  });

  it('says an edit is not committed yet when no commit changed the part', () => {
    expect(editNoteOf({ note: 'die Änderung', commits: [], states: { removed: [], added: [], redrawn: [] } })).toBe(
      'die Änderung: noch nicht committet',
    );
  });
});

describe('editCommitsOf', () => {
  it('answers the commits after the old stand that changed the part folder', () => {
    const repo = mkdtempSync(join(tmpdir(), 'edit-summary-'));
    const partDir = join(repo, 'elements/variant-cell');

    mkdirSync(partDir, { recursive: true });
    writeFileSync(join(partDir, 'variant-cell.ts'), 'a');
    initGitRepo(repo, 'old stand');
    const since = String(git(repo, 'rev-parse', 'HEAD')).trim();
    writeFileSync(join(repo, 'other.ts'), 'b');
    commitAll(repo, 'touch another file');
    writeFileSync(join(partDir, 'variant-cell.ts'), 'c');
    commitAll(repo, 'fix: drop selected');

    expect(editCommitsOf({ partDir, since }).map((commit) => commit.subject)).toEqual(['fix: drop selected']);
    expect(editCommitsOf({ partDir, since: undefined })).toEqual([]);
  });

  const root = resolve(__dirname, '../../../../../../..');
  const known = (() => {
    try {
      execFileSync('git', ['cat-file', '-e', '7452d1328aec0dbcfe61a30bfdb04cb855a5a028^{commit}'], { cwd: root });

      return true;
    } catch {
      return false;
    }
  })();

  it.skipIf(!known)('names e9b96c84d for the studio variant-cell edit', () => {
    const commits = editCommitsOf({
      partDir: join(root, '.ethlete/design/studio/elements/variant-cell'),
      since: '7452d1328aec0dbcfe61a30bfdb04cb855a5a028',
    });

    expect(commits.map((commit) => commit.hash.slice(0, 9))).toContain('e9b96c84d');
  });
});
