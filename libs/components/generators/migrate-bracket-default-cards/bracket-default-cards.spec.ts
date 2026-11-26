import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';
import { scanBracketDefaultCardsInFile } from './bracket-default-cards';
import migrateBracketDefaultCards, { BRACKET_DEFAULT_CARDS_REPORT_PATH } from './migration';

const FILE = 'apps/shop/src/app/app.config.ts';

describe('migrate-bracket-default-cards', () => {
  it('spreads the default cards first into a literal config and imports them', () => {
    const { next } = scanBracketDefaultCardsInFile(
      FILE,
      [
        "import { provideBracketConfig, singleEliminationBracketLayout } from '@ethlete/components';",
        'export const providers = [provideBracketConfig({ layouts: [singleEliminationBracketLayout()] })];',
      ].join('\n'),
    );

    expect(next).toBe(
      [
        "import { BRACKET_DEFAULT_CARDS, provideBracketConfig, singleEliminationBracketLayout } from '@ethlete/components';",
        'export const providers = [provideBracketConfig({ ...BRACKET_DEFAULT_CARDS, layouts: [singleEliminationBracketLayout()] })];',
      ].join('\n'),
    );
  });

  it('fills an empty call', () => {
    const { next } = scanBracketDefaultCardsInFile(
      FILE,
      "import { provideBracketConfig } from '@ethlete/components';\nprovideBracketConfig();\nprovideBracketConfig({});",
    );

    expect(next).toBe(
      "import { BRACKET_DEFAULT_CARDS, provideBracketConfig } from '@ethlete/components';\nprovideBracketConfig({ ...BRACKET_DEFAULT_CARDS });\nprovideBracketConfig({ ...BRACKET_DEFAULT_CARDS });",
    );
  });

  it('reports a call whose config it cannot see', () => {
    const { next, tasks, hasConfig } = scanBracketDefaultCardsInFile(
      FILE,
      "import { provideBracketConfig } from '@ethlete/components';\n\nprovideBracketConfig(SHARED_BRACKET_CONFIG);",
    );

    expect(next).toBeNull();
    expect(hasConfig).toBe(true);
    expect(tasks).toEqual([
      expect.objectContaining({ file: FILE, line: 3, message: expect.stringContaining('SHARED_BRACKET_CONFIG') }),
    ]);
  });

  it('leaves a file alone that already spreads the default cards', () => {
    const { next, hasConfig } = scanBracketDefaultCardsInFile(
      FILE,
      "import { BRACKET_DEFAULT_CARDS, provideBracketConfig } from '@ethlete/components';\nprovideBracketConfig({ ...BRACKET_DEFAULT_CARDS });",
    );

    expect(next).toBeNull();
    expect(hasConfig).toBe(true);
  });

  it('leaves a provideBracketConfig that is not from @ethlete/components alone', () => {
    expect(
      scanBracketDefaultCardsInFile(FILE, "import { provideBracketConfig } from './local';\nprovideBracketConfig({});")
        .next,
    ).toBeNull();
  });

  it.each([
    ['<et-bracket [source]="source" />', true],
    ['<et-bracket-rounds-list [source]="source" />', true],
    ['<et-bracket-participants [source]="source" />', false],
    ["import { BRACKET_IMPORTS } from '@ethlete/components';", true],
  ])('treats %s as a bracket usage: %s', (content, expected) => {
    expect(scanBracketDefaultCardsInFile('apps/shop/src/app/bracket.html', content).usesBracket).toBe(expected);
  });

  it('rewrites the config and reports nothing when the app has one', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write('apps/shop/src/app/bracket.component.html', '<et-bracket [source]="source" />\n');
    tree.write(
      'apps/shop/src/app/app.config.ts',
      "import { provideBracketConfig } from '@ethlete/components';\n\nexport const providers = [provideBracketConfig({ layouts: [] })];\n",
    );

    await migrateBracketDefaultCards(tree, { skipFormat: true });

    expect(tree.read('apps/shop/src/app/app.config.ts', 'utf-8')).toBe(
      "import { BRACKET_DEFAULT_CARDS, provideBracketConfig } from '@ethlete/components';\n\nexport const providers = [provideBracketConfig({ ...BRACKET_DEFAULT_CARDS, layouts: [] })];\n",
    );
    expect(tree.exists(BRACKET_DEFAULT_CARDS_REPORT_PATH)).toBe(false);
  });

  it('reports the brackets of an app without any bracket config', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write('apps/shop/src/app/bracket.component.html', '<et-bracket [layouts]="layouts" [source]="source" />\n');

    await migrateBracketDefaultCards(tree, { skipFormat: true });

    const report = tree.read(BRACKET_DEFAULT_CARDS_REPORT_PATH, 'utf-8');

    expect(report).toContain('apps/shop/src/app/bracket.component.html:1');
    expect(report).toContain('provideBracketConfig({ ...BRACKET_DEFAULT_CARDS })');
  });
});
