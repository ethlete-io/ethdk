import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { describe, expect, it } from 'vitest';
import { renameBracketEthleteExportsInFile } from './bracket-ethlete-renames';
import migrateBracketEthleteRenames from './migration';

describe('migrate-bracket-ethlete-renames', () => {
  it('renames the import and every reference', () => {
    const result = renameBracketEthleteExportsInFile(
      [
        "import { generateTournamentModeFormEthleteRounds } from '@ethlete/components';",
        '',
        'const mode = generateTournamentModeFormEthleteRounds(stage);',
      ].join('\n'),
    );

    expect(result).toBe(
      [
        "import { generateTournamentModeFromEthleteRounds } from '@ethlete/components';",
        '',
        'const mode = generateTournamentModeFromEthleteRounds(stage);',
      ].join('\n'),
    );
  });

  it('leaves a file alone that does not import from @ethlete/components', () => {
    expect(
      renameBracketEthleteExportsInFile(
        "import { generateTournamentModeFormEthleteRounds } from './local';\ngenerateTournamentModeFormEthleteRounds(stage);",
      ),
    ).toBeNull();
  });

  it('reports no change for a file without the old name', () => {
    expect(renameBracketEthleteExportsInFile("import { BRACKET_IMPORTS } from '@ethlete/components';")).toBeNull();
  });

  it('rewrites the files in the tree', async () => {
    const tree = createTreeWithEmptyWorkspace();

    tree.write(
      'apps/shop/src/app/bracket.ts',
      "import { generateTournamentModeFormEthleteRounds } from '@ethlete/components';\n\nexport const mode = generateTournamentModeFormEthleteRounds([]);\n",
    );

    await migrateBracketEthleteRenames(tree, { skipFormat: true });

    expect(tree.read('apps/shop/src/app/bracket.ts', 'utf-8')).toBe(
      "import { generateTournamentModeFromEthleteRounds } from '@ethlete/components';\n\nexport const mode = generateTournamentModeFromEthleteRounds([]);\n",
    );
  });
});
