import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  collectTailwindThemeNames,
  emptyTailwindThemeNames,
  migrateThemeTokenNames,
  TailwindThemeNames,
} from './theme-token-names';
import { THEME_TOKEN_RENAMES } from './token-names';

const FIXTURES = join(__dirname, '__fixtures__');

const namesOf = (app: string) => {
  const names = emptyTailwindThemeNames();

  for (const file of readdirSync(join(FIXTURES, app))) {
    collectTailwindThemeNames(readFileSync(join(FIXTURES, app, file), 'utf-8'), names);
  }

  return names;
};

const plain = (names: TailwindThemeNames) => ({
  color: Object.fromEntries([...names.colorPrefixes].map(([prefix, themes]) => [prefix, [...themes]])),
  surface: Object.fromEntries([...names.surfacePrefixes].map(([prefix, themes]) => [prefix, [...themes]])),
});

const migrate = (source: string) => migrateThemeTokenNames(source);

describe('collectTailwindThemeNames', () => {
  it('reads the prefix and the theme names from the generated files of app-a', () => {
    expect(plain(namesOf('app-a'))).toEqual({
      color: { aa: ['light-grey', 'dark-grey', 'brand'] },
      surface: { et: ['app-dark', 'app-dark-inset'] },
    });
  });

  it('reads the prefix and the theme names from the generated files of app-b', () => {
    expect(plain(namesOf('app-b'))).toEqual({
      color: { bb: ['pitch-green', 'red'] },
      surface: { bb: ['dark', 'dark-elevated'] },
    });
  });
});

describe.each(['app-a', 'app-b'])('migrateThemeTokenNames on the %s fixtures', (app) => {
  const names = namesOf(app);
  const files = readdirSync(join(FIXTURES, app)).filter((file) => !file.startsWith('generated-'));

  it.each(files)('%s', async (file) => {
    const result = migrateThemeTokenNames(readFileSync(join(FIXTURES, app, file), 'utf-8'), names);

    await expect(result.content).toMatchFileSnapshot(join(FIXTURES, '__snapshots__', app, file));
    expect(result.findings).toMatchSnapshot();
  });

  it('leaves the generated theme files alone', () => {
    for (const file of readdirSync(join(FIXTURES, app)).filter((name) => name.startsWith('generated-'))) {
      const source = readFileSync(join(FIXTURES, app, file), 'utf-8');

      expect(migrateThemeTokenNames(source, names)).toEqual({ content: source, changed: false, findings: [] });
    }
  });
});

describe('migrateThemeTokenNames', () => {
  it('turns rgb() over a triplet into the color, and an alpha into color-mix', () => {
    expect(migrate('a { color: rgb(var(--et-color-primary)); }').content).toBe(
      'a { color: var(--et-tone-fill-rest); }',
    );
    expect(migrate('a { color: rgb(var(--et-surface-color-muted-rgb) / 0.5); }').content).toBe(
      'a { color: color-mix(in srgb, var(--et-surface-text-muted) 50%, transparent); }',
    );
    expect(migrate('a { color: rgba(var(--et-color-on-primary), 0.08); }').content).toBe(
      'a { color: color-mix(in srgb, var(--et-tone-on-fill-rest) 8%, transparent); }',
    );
    expect(migrate('a { color: rgb(var(--et-color-primary-ink-hover) / var(--alpha)); }').content).toBe(
      'a { color: color-mix(in srgb, var(--et-tone-text-hover) calc(var(--alpha) * 100%), transparent); }',
    );
  });

  it('reads the opacity knob under its private name', () => {
    expect(
      migrate('a { --_bg: rgb(var(--et-theme-color-primary-rgb) / var(--et-theme-color-primary-opacity)); }').content,
    ).toBe(
      'a { --_bg: color-mix(in srgb, var(--et-tone-fill) calc(var(--_et-tone-fill-opacity, 1) * 100%), transparent); }',
    );
    expect(migrate('a { --et-theme-color-primary-opacity: 0; }').content).toBe('a { --_et-tone-fill-opacity: 0; }');
  });

  it('drops the on-fill and text opacity knobs that are always 1', () => {
    const source = `a {
  --et-theme-color-ink-opacity: 1;
  color: rgb(var(--et-theme-color-ink-rgb) / var(--et-theme-color-ink-opacity));
}`;

    expect(migrate(source).content).toBe(`a {
  color: var(--et-tone-text);
}`);
  });

  it('turns a literal triplet fallback and a triplet value into rgb()', () => {
    expect(migrate('a { box-shadow: 0 1px rgb(var(--et-shadow-color-rgb, 0 0 0) / 0.2); }').content).toBe(
      'a { box-shadow: 0 1px color-mix(in srgb, var(--et-shadow-color, rgb(0 0 0)) 20%, transparent); }',
    );
    expect(migrate('a { --et-scrim-color-rgb: 10 13 16; }').content).toBe('a { --et-scrim-color: rgb(10 13 16); }');
  });

  it('keeps Tailwind underscores in an arbitrary value', () => {
    expect(migrate('<i class="from-[rgb(var(--et-color-primary)_/_25%)]"></i>').content).toBe(
      '<i class="from-[color-mix(in_srgb,var(--et-tone-fill-rest)_25%,transparent)]"></i>',
    );
  });

  it('deletes a declaration that becomes a reference to itself', () => {
    const source = `:root {
  --et-surface-background-rgb: var(--et-surface-background);
  --et-surface-background-solid: rgb(var(--et-surface-background-rgb));
  --gap: 1rem;
}`;

    expect(migrate(source).content).toBe(`:root {
  --gap: 1rem;
}`);
  });

  it('is a no-op on migrated text', () => {
    const source = 'a { color: var(--et-surface-text); background: var(--et-surface-background); }';

    expect(migrate(source)).toEqual({ content: source, changed: false, findings: [] });
  });

  describe('stops with file and line instead of guessing', () => {
    const findingsOf = (source: string) => migrate(source).findings.map(({ line, reason }) => ({ line, reason }));

    it('reports a live -rgb reassigned without its -solid partner and leaves it as it is', () => {
      const source = `.et-button {
  &:hover {
    --et-theme-color-primary-rgb: var(--et-button-filled-hover-rgb, var(--et-color-primary-hover));
  }
}`;
      const result = migrate(source);

      expect(result.content).toBe(source);
      expect(result.findings).toEqual([
        expect.objectContaining({
          line: 3,
          reason: expect.stringContaining(
            '--et-theme-color-primary-rgb is reassigned without --et-theme-color-primary-solid',
          ),
        }),
      ]);
    });

    it('rewrites a -rgb reassigned together with its -solid partner', () => {
      const source = `a {
  --et-surface-interaction-rgb: var(--et-surface-interaction-hover);
  --et-surface-interaction-solid: var(--et-surface-interaction-hover-solid);
}`;
      expect(migrate(source)).toEqual({
        content: `a {
  --et-surface-interaction: var(--et-surface-interaction-hover);
}`,
        changed: true,
        findings: [],
      });
    });

    it('reports two old names that merge into one new name with different values', () => {
      const source = `a {
  --et-surface-border: var(--et-surface-color-subtle);
  --et-surface-border-solid: var(--app-line);
}`;

      expect(findingsOf(source)).toEqual([
        {
          line: 3,
          reason:
            '--et-surface-border and --et-surface-border-solid are both set here and merge into --et-surface-border: keep one by hand',
        },
      ]);
    });

    it('reports rgb() over a surface name whose fallback is not a literal', () => {
      expect(findingsOf('a { color: rgb(var(--et-surface-background, var(--app-bg))); }')).toEqual([
        { line: 1, reason: 'rgb() over a var chain that mixes old triplet names with other names: rewrite it by hand' },
      ]);
    });

    it('reports a triplet read outside rgb()', () => {
      expect(findingsOf('a {\n  --_ring: var(--et-color-primary);\n}')).toEqual([
        {
          line: 2,
          reason: '--et-color-primary is a triplet read outside rgb() (in --_ring): check every reader by hand',
        },
      ]);
    });

    it('reports an old triplet name set from a value it cannot type', () => {
      expect(findingsOf('a {\n  --et-color-primary: var(--brand-rgb);\n}')).toEqual([
        {
          line: 2,
          reason:
            '--et-color-primary holds a triplet; its new name --et-tone-fill-rest holds a color: rewrite this value by hand',
        },
      ]);
    });

    it('reports a removed name', () => {
      expect(findingsOf('a { color: rgb(var(--et-color-secondary)); }')).toEqual([
        { line: 1, reason: 'rgb() over a var chain that mixes old triplet names with other names: rewrite it by hand' },
      ]);
      expect(findingsOf('a { --et-theme-color-ink-opacity: 0.5; }')).toEqual([
        {
          line: 1,
          reason: '--et-theme-color-ink-opacity is removed and only 1 is supported: replace this declaration by hand',
        },
      ]);
    });

    it('reports a retired name that is not in the table', () => {
      expect(findingsOf('<i class="[--et-avatar-background:var(--et-surface-bg-solid)]"></i>')).toEqual([
        { line: 1, reason: 'old theme token left: --et-surface-bg-solid' },
      ]);
      expect(findingsOf('const name = `--et-theme-color-primary-${state}`;')).toEqual([
        { line: 1, reason: 'old theme token left: --et-theme-color-primary-$' },
      ]);
    });

    it('does not report the names that stay', () => {
      expect(
        findingsOf(
          'a { --et-surface-type: dark; --et-color-theme-type: error; --et-color-picker-thumb-size: 1rem; --et-surface-elevation: 2; }',
        ),
      ).toEqual([]);
    });
  });

  it('gives every old name a new name or marks it removed', () => {
    expect(
      THEME_TOKEN_RENAMES.filter((entry) => entry.new === null).every(
        (entry) => entry.kind.startsWith('dropped') || entry.kind === 'dropped',
      ),
    ).toBe(true);
    expect(new Set(THEME_TOKEN_RENAMES.map((entry) => entry.old)).size).toBe(THEME_TOKEN_RENAMES.length);
  });
});

describe('migrateThemeTokenNames on Tailwind arbitrary-property shorthand', () => {
  const findingsOf = (source: string) => migrate(source).findings.map(({ line, reason }) => ({ line, reason }));

  it('renames a color read in the shorthand, with variants, a type hint and in a TS string', () => {
    const source = `<div class="flex grow bg-(--et-surface-background-solid) hover:bg-(--et-surface-border-solid)">
  <span class="rounded-sm bg-(--et-theme-color-primary-solid) text-(--et-theme-color-on-primary) border-(color:--et-theme-color-primary)"></span>
</div>`;

    expect(migrate(source)).toEqual({
      content: `<div class="flex grow bg-(--et-surface-background) hover:bg-(--et-surface-border)">
  <span class="rounded-sm bg-(--et-tone-fill) text-(--et-tone-on-fill) border-(color:--et-tone-fill)"></span>
</div>`,
      changed: true,
      findings: [],
    });
    expect(migrate(`: 'bg-(--et-surface-background-solid) ring-(--et-surface-border-solid)';`).content).toBe(
      `: 'bg-(--et-surface-background) ring-(--et-surface-border)';`,
    );
  });

  it('is idempotent', () => {
    const once = migrate(
      '<i class="md:hover:text-(--et-surface-color-muted-solid) bg-(--et-theme-color-primary)"></i>',
    );

    expect(once.content).toBe('<i class="md:hover:text-(--et-surface-text-muted) bg-(--et-tone-fill)"></i>');
    expect(migrate(once.content)).toEqual({ content: once.content, changed: false, findings: [] });
  });

  it('leaves a shorthand over a name outside the table alone', () => {
    const source =
      '<div class="md:px-(--et-overlay-padding-inline) md:py-(--et-overlay-padding-block) w-(--et-vw)"></div>';

    expect(migrate(source)).toEqual({ content: source, changed: false, findings: [] });
  });

  it('stops on a triplet, a removed name and the opacity knob read through the shorthand', () => {
    const source = `<i class="bg-(--et-surface-color-rgb)"></i>
<i class="text-(--et-color-primary)"></i>
<i class="bg-(--et-color-secondary)"></i>
<i class="opacity-(--et-theme-color-primary-opacity)"></i>`;

    expect(migrate(source).content).toBe(source);
    expect(findingsOf(source)).toEqual([
      { line: 1, reason: '--et-surface-color-rgb is a triplet read outside rgb(): check every reader by hand' },
      { line: 2, reason: '--et-color-primary is a triplet read outside rgb(): check every reader by hand' },
      { line: 3, reason: '--et-color-secondary is removed: replace it by hand' },
      {
        line: 4,
        reason:
          '--et-theme-color-primary-opacity has no shorthand form after the rename: rewrite it as an arbitrary value by hand',
      },
    ]);
  });
});

describe('migrateThemeTokenNames on names that are not custom properties', () => {
  it('never renames a data attribute that shares a Tailwind color name', () => {
    const names = namesOf('app-a');
    const source = `<div class="card" data-et-surface><div data-et-surface></div></div>
[data-et-surface] { outline: none; }
const surfaces = root.querySelectorAll('[data-et-surface]');
<p class="text-et-surface hover:bg-et-surface-bg"></p>`;

    expect(migrateThemeTokenNames(source, names)).toEqual({
      content: `<div class="card" data-et-surface><div data-et-surface></div></div>
[data-et-surface] { outline: none; }
const surfaces = root.querySelectorAll('[data-et-surface]');
<p class="text-et-surface-text hover:bg-et-surface-background"></p>`,
      changed: true,
      findings: [],
    });
  });

  it.each(['<div aria-et-surface></div>', '<i class="foo-et-surface-bg"></i>', '<i x-et-surface="1"></i>'])(
    'leaves %s alone because no color utility precedes the name',
    (source) => {
      expect(migrateThemeTokenNames(source, namesOf('app-a'))).toEqual({
        content: source,
        changed: false,
        findings: [],
      });
    },
  );

  it('renames a theme name behind a border side, a gradient stop and the theme key', () => {
    const source = `<i class="border-t-et-surface-bg from-et-surface-bg/50 !ring-offset-et-surface-bg"></i>
--color-et-surface-bg: var(--x);`;

    expect(migrateThemeTokenNames(source, namesOf('app-a')).content).toBe(
      `<i class="border-t-et-surface-background from-et-surface-background/50 !ring-offset-et-surface-background"></i>
--color-et-surface-background: var(--x);`,
    );
  });

  it('rewrites a triplet declared in a style attribute together with its reader', () => {
    const source = `<div style="--et-surface-background: 60 70 80;background-color:rgb(var(--et-surface-background))"></div>
const SURFACE = 'style="--et-surface-background: 20 30 40"';`;

    expect(migrate(source)).toEqual({
      content: `<div style="--et-surface-background: rgb(60 70 80);background-color:var(--et-surface-background)"></div>
const SURFACE = 'style="--et-surface-background: rgb(20 30 40)"';`,
      changed: true,
      findings: [],
    });
  });

  it('reports an old name set from script', () => {
    const source = `el.style.setProperty('--et-surface-color', '1 2 3');`;

    expect(migrate(source).findings.map(({ line, reason }) => ({ line, reason }))).toEqual([
      { line: 1, reason: 'old theme token left: --et-surface-color' },
    ]);
  });
});

describe('migrateThemeTokenNames on a real first-run pair', () => {
  const dir = join(FIXTURES, 'studio-first-run');
  const files = readdirSync(dir);

  it.each(files.filter((file) => file !== 'colors.css.txt'))(
    'changes nothing on a second run over the output of the first run of %s',
    (file) => {
      const first = migrate(readFileSync(join(dir, file), 'utf-8'));
      const second = migrate(first.content);

      expect(second.changed).toBe(false);
      expect(second.findings).toEqual([]);
    },
  );

  it('reports nothing on the already renamed sdk colors.css', () => {
    const result = migrate(readFileSync(join(dir, 'colors.css.txt'), 'utf-8'));

    expect(result.findings).toEqual([]);
    expect(result.changed).toBe(false);
  });

  it('renames a solid var() inside a Tailwind arbitrary value', () => {
    const source = `<div class="h-40 w-56 rounded-control-md bg-et-surface-bg shadow-[0_0_0_1px_var(--et-surface-border-solid)]"></div>`;

    expect(migrate(source).content).toBe(
      `<div class="h-40 w-56 rounded-control-md bg-et-surface-bg shadow-[0_0_0_1px_var(--et-surface-border)]"></div>`,
    );
    expect(migrate(source).findings).toEqual([]);
  });
  describe('string literals that hold one token name', () => {
    const dir = join(FIXTURES, 'e2e-strings');

    it.each(readdirSync(dir))('renames every old name in %s and reports nothing', (file) => {
      const result = migrate(readFileSync(join(dir, file), 'utf-8'));

      expect(result.changed).toBe(true);
      expect(result.content).not.toMatch(/['"`]--et-[\w-]*-solid['"`]/);
      expect(result.findings).toEqual([]);
      expect(migrate(result.content).changed).toBe(false);
    });

    it('renames getPropertyValue and setProperty names', () => {
      const source = `style.getPropertyValue('--et-surface-border-solid');\nel.style.setProperty("--et-theme-color-ink-solid", 'rgb(1 2 3)');`;

      expect(migrate(source).content).toBe(
        `style.getPropertyValue('--et-surface-border');\nel.style.setProperty("--et-tone-text", 'rgb(1 2 3)');`,
      );
    });

    it('keeps a name that is only part of a string and reports it', () => {
      const source = `const list = '--et-surface-border-solid, --et-surface-background-solid';`;
      const result = migrate(source);

      expect(result.content).toBe(source);
      expect(result.findings).toHaveLength(1);
    });

    it('keeps a refused -rgb triplet name and reports it', () => {
      const source = `el.style.setProperty('--et-surface-background-rgb', '1 2 3');`;
      const result = migrate(source);

      expect(result.content).toBe(source);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0]?.reason).toContain('old theme token left');
    });
  });
});
