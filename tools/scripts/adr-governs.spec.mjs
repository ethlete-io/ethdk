import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { citationsOf, citedAdrs, governingAdrs, parseAdr } from './adr-governs.mjs';
import { gitSpawn } from './git-test-env.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), 'adr-governs.mjs');
const created = [];

after(() => created.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

const adrText = (status, governs, title) =>
  `---\nstatus: ${status}\nopen: none\ngoverns: ${governs}\n---\n\n# ${title}\n\nBody.\n`;

const adrs = [
  parseAdr('docs/adr/0001-hooks.md', adrText('accepted', "['.husky/*', 'tools/scripts/*gate*']", 'Hooks stay thin')),
  parseAdr('docs/adr/0002-old.md', adrText('superseded by 0001', "['.husky/*']", 'Old hooks')),
];

test('matches files against the globs of an accepted ADR', () => {
  const hits = governingAdrs(adrs, ['.husky/pre-commit', 'tools/scripts/design-rules-gate.mjs']);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].number, '0001');
  assert.equal(hits[0].title, 'Hooks stay thin');
  assert.deepEqual(hits[0].matched, ['.husky/pre-commit', 'tools/scripts/design-rules-gate.mjs']);
});

test('lists nothing when no file matches', () => {
  assert.deepEqual(governingAdrs(adrs, ['libs/core/src/index.ts', '.husky/nested/deep']), []);
});

test('skips a superseded ADR', () => {
  const hits = governingAdrs(adrs, ['.husky/pre-push']);
  assert.deepEqual(
    hits.map((h) => h.number),
    ['0001'],
  );
});

test('--staged reads the staged files of a temp repo', () => {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'adr-governs-')));
  created.push(repo);
  const run = (...args) => gitSpawn(args, { cwd: repo });
  run('init', '--quiet');
  mkdirSync(join(repo, 'docs', 'adr'), { recursive: true });
  mkdirSync(join(repo, '.husky'));
  writeFileSync(join(repo, 'docs', 'adr', '0001-hooks.md'), adrText('accepted', "['.husky/*']", 'Hooks stay thin'));
  writeFileSync(join(repo, '.husky', 'pre-commit'), '');
  writeFileSync(join(repo, 'other.txt'), '');
  run('add', '.husky/pre-commit', 'docs');

  const staged = spawnSync('node', [script, '--staged'], { cwd: repo, encoding: 'utf8' });
  assert.equal(staged.status, 0);
  assert.match(staged.stdout, /ADR 0001 Hooks stay thin/);
  assert.match(staged.stdout, /\.husky\/pre-commit/);

  const none = spawnSync('node', [script, 'other.txt'], { cwd: repo, encoding: 'utf8' });
  assert.equal(none.stdout, '');
});

test('lists the ADRs a file cites by number, superseded ones too', () => {
  const citations = [
    citationsOf('handoff.md', 'Night shift rule (ADR 0002), see ADR 0001 and ADR 0001 again; 0003 is no ADR.'),
  ];
  const cited = citedAdrs(adrs, citations);
  assert.deepEqual(
    cited.map((adr) => [adr.number, adr.citedIn]),
    [
      ['0001', ['handoff.md']],
      ['0002', ['handoff.md']],
    ],
  );
});

test('the CLI names the ADRs an untracked handoff cites', () => {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'adr-governs-')));
  created.push(repo);
  gitSpawn(['init', '--quiet'], { cwd: repo });
  mkdirSync(join(repo, 'docs', 'adr'), { recursive: true });
  writeFileSync(join(repo, 'docs', 'adr', '0001-hooks.md'), adrText('accepted', "['.husky/*']", 'Hooks stay thin'));
  writeFileSync(join(repo, 'handoff.md'), 'Scope: ADR 0001 only.\n');

  const out = spawnSync('node', [script, 'handoff.md'], { cwd: repo, encoding: 'utf8' });
  assert.equal(out.status, 0);
  assert.match(out.stdout, /ADR 0001 Hooks stay thin \[accepted\]/);
  assert.match(out.stdout, /cited in handoff\.md/);
});
