import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  SeedManifest,
  parseSeedList,
  parseSeedManifest,
  readSeedManifest,
  seedCopyArgs,
  seedListText,
  seedRunArgs,
  seedSteps,
  shellQuote,
  tarDirectory,
} from './seeds';

const MANIFEST: SeedManifest = {
  fixtures: ['bin/console doctrine:fixtures:load -n'],
  seeds: {
    rewards: { description: 'Reward pass art', run: ['bin/console app:reward:demo:seed', 'php $SEED_DIR/reward.php'] },
    wc26: { run: ['php $SEED_DIR/wc26.php'], env: { WC26_TITLE: 'rocket-league' } },
  },
};

const problemOf = (value: unknown) => {
  const result = parseSeedManifest(value);

  return result.ok ? undefined : result.problem;
};

describe('parseSeedManifest', () => {
  it('accepts a manifest with fixtures and seeds', () => {
    expect(parseSeedManifest(MANIFEST)).toEqual({ ok: true, value: MANIFEST });
  });

  it('accepts a manifest without fixtures or seeds', () => {
    expect(parseSeedManifest({})).toEqual({ ok: true, value: { fixtures: undefined, seeds: {} } });
  });

  it('names an unknown top-level key', () => {
    expect(problemOf({ seed: {} })).toBe('Unknown key "seed". Known keys: fixtures, seeds.');
  });

  it('rejects fixtures that are not a list of lines', () => {
    expect(problemOf({ fixtures: 'make fixtures' })).toContain('fixtures must be a non-empty list');
    expect(problemOf({ fixtures: [] })).toContain('fixtures must be a non-empty list');
  });

  it('names the seed whose run list is wrong', () => {
    expect(problemOf({ seeds: { rewards: { run: [''] } } })).toBe(
      'seeds.rewards.run must be a non-empty list of shell lines.',
    );
  });

  it('names an unknown key of a seed', () => {
    expect(problemOf({ seeds: { rewards: { run: ['x'], descripton: 'typo' } } })).toContain(
      'seeds.rewards has an unknown key "descripton"',
    );
  });

  it('rejects a seed name a comma list cannot carry', () => {
    expect(problemOf({ seeds: { 'a,b': { run: ['x'] } } })).toContain('"a,b" is not a seed name');
  });

  it('rejects an env that is not a map of variable names to strings', () => {
    expect(problemOf({ seeds: { a: { run: ['x'], env: { 'NOT-A-NAME': 'x' } } } })).toContain('seeds.a.env');
    expect(problemOf({ seeds: { a: { run: ['x'], env: { COUNT: 3 } } } })).toContain('seeds.a.env');
  });
});

describe('readSeedManifest', () => {
  const makeRoot = (contents?: string) => {
    const root = mkdtempSync(join(tmpdir(), 'cli-api-seeds-'));

    if (contents !== undefined) {
      mkdirSync(join(root, '.ethlete/seeds/hub'), { recursive: true });
      writeFileSync(join(root, '.ethlete/seeds/hub/seeds.json'), contents, 'utf8');
    }

    return root;
  };

  it('names the file to create when there is none', () => {
    const result = readSeedManifest(makeRoot(), 'hub');

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.problem).toContain('Create .ethlete/seeds/hub/seeds.json');
  });

  it('reports invalid JSON with the file name', () => {
    const result = readSeedManifest(makeRoot('{'), 'hub');

    expect(result.ok ? '' : result.problem).toContain('.ethlete/seeds/hub/seeds.json is not valid JSON');
  });

  it('prefixes a validation problem with the file name', () => {
    const result = readSeedManifest(makeRoot('{"seeds": []}'), 'hub');

    expect(result.ok ? '' : result.problem).toBe(
      '.ethlete/seeds/hub/seeds.json: seeds must be an object of named seeds.',
    );
  });
});

describe('parseSeedList', () => {
  it('splits a comma list and drops empty names', () => {
    expect(parseSeedList(' rewards, ,wc26 ')).toEqual(['rewards', 'wc26']);
    expect(parseSeedList(undefined)).toEqual([]);
  });
});

describe('seedSteps', () => {
  it('runs the seeds in the order they were named', () => {
    const steps = seedSteps({ manifest: MANIFEST, names: ['wc26', 'rewards'], withFixtures: false, api: 'hub' });

    expect(steps.ok && steps.value.map(({ label }) => label)).toEqual(['wc26', 'rewards']);
  });

  it('runs the fixtures first', () => {
    const steps = seedSteps({ manifest: MANIFEST, names: ['rewards'], withFixtures: true, api: 'hub' });

    expect(steps.ok && steps.value.map(({ label }) => label)).toEqual(['fixtures', 'rewards']);
  });

  it('suggests the seed behind a typo', () => {
    const steps = seedSteps({ manifest: MANIFEST, names: ['rewards', 'wc27'], withFixtures: false, api: 'hub' });

    expect(steps.ok ? '' : steps.problem).toBe(
      'The hub API has no seed "wc27". Did you mean "wc26"?\n\nSeeds: rewards, wc26',
    );
  });

  it('fails a fixtures call when the manifest declares none', () => {
    const steps = seedSteps({ manifest: { seeds: {} }, names: [], withFixtures: true, api: 'hub' });

    expect(steps.ok ? '' : steps.problem).toBe('.ethlete/seeds/hub/seeds.json declares no fixtures.');
  });
});

describe('seedListText', () => {
  it('lists each seed with its description, or its lines when it has none', () => {
    const text = seedListText({ api: 'hub', manifest: MANIFEST, invocation: 'et api' });

    expect(text).toContain('  rewards  Reward pass art');
    expect(text).toContain('  wc26     php $SEED_DIR/wc26.php');
    expect(text).toContain('Run them with "et api seed hub rewards,wc26".');
  });
});

describe('compose arguments', () => {
  it('unpacks the tar from stdin without a TTY', () => {
    expect(seedCopyArgs('app', '/tmp/ethlete-seeds/hub')).toEqual([
      'exec',
      '-T',
      'app',
      'sh',
      '-c',
      `rm -rf '/tmp/ethlete-seeds/hub' && mkdir -p '/tmp/ethlete-seeds/hub' && tar -x -C '/tmp/ethlete-seeds/hub'`,
    ]);
  });

  it('exports SEED_DIR and the seed env before its lines', () => {
    const step = { label: 'wc26', lines: ['php $SEED_DIR/a.php', 'echo done'], env: { TITLE: "it's" } };

    expect(seedRunArgs({ service: 'app', directory: '/tmp/ethlete-seeds/hub', step, tty: true })).toEqual([
      'exec',
      'app',
      'sh',
      '-c',
      `set -e\nexport SEED_DIR='/tmp/ethlete-seeds/hub'\nexport TITLE='it'\\''s'\nphp $SEED_DIR/a.php\necho done`,
    ]);
  });

  it('drops the TTY when stdin is not a terminal', () => {
    const step = { label: 'a', lines: ['true'], env: {} };

    expect(seedRunArgs({ service: 'app', directory: '/d', step, tty: false }).slice(0, 3)).toEqual([
      'exec',
      '-T',
      'app',
    ]);
  });

  it('quotes a value for sh', () => {
    expect(spawnSync('sh', ['-c', `printf %s ${shellQuote(`a'b "c" $d`)}`], { encoding: 'utf8' }).stdout).toBe(
      `a'b "c" $d`,
    );
  });
});

describe('tarDirectory', () => {
  it('builds an archive tar unpacks with every file and folder', () => {
    const source = mkdtempSync(join(tmpdir(), 'cli-api-tar-src-'));
    const target = mkdtempSync(join(tmpdir(), 'cli-api-tar-dst-'));
    const deep = `${'d'.repeat(60)}/${'e'.repeat(60)}`;

    mkdirSync(join(source, 'art', deep), { recursive: true });
    writeFileSync(join(source, 'seeds.json'), '{}', 'utf8');
    writeFileSync(join(source, 'art/one.png'), Buffer.from([0, 1, 2, 255]));
    writeFileSync(join(source, 'art', deep, 'long-name.txt'), 'x'.repeat(1000), 'utf8');

    const extracted = spawnSync('tar', ['-x', '-C', target], { input: tarDirectory(source) });
    const listed = spawnSync('find', ['.', '-type', 'f'], { cwd: target, encoding: 'utf8' });

    expect(extracted.status).toBe(0);
    expect(listed.stdout.split('\n').filter(Boolean).sort()).toEqual(
      ['./art/one.png', `./art/${deep}/long-name.txt`, './seeds.json'].sort(),
    );
    expect(spawnSync('cmp', [join(source, 'art/one.png'), join(target, 'art/one.png')]).status).toBe(0);
  });
});
