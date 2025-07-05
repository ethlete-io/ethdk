import { NewBracket } from './bracket';

const pad = (str: string, len: number) => str.padEnd(len, ' ');
const color = (str: string, code: number) => `\x1b[${code}m${str}\x1b[0m`;
const roundColor = (str: string) => color(str, 36); // cyan
const arrowColor = (str: string) => color(str, 90); // gray
const labelColor = (str: string) => color(str, 33); // yellow
const factorColor = (str: string) => color(str, 32); // green

export const logRoundRelations = (bracketData: NewBracket<unknown, unknown>) => {
  // Find max round name length for alignment
  let maxNameLen = 0;
  for (const round of bracketData.rounds.values()) {
    maxNameLen = Math.max(maxNameLen, round.name.length);
  }
  const colWidth = maxNameLen + 2;

  // Build rows
  const rows: string[][] = [];
  for (const round of bracketData.rounds.values()) {
    const relation = round.relation;
    switch (relation.type) {
      case 'nothing-to-one':
        rows.push([
          labelColor(pad('START', colWidth)),
          arrowColor('──▶'),
          roundColor(pad(round.name, colWidth)),
          arrowColor('──▶'),
          roundColor(pad(relation.nextRound.name, colWidth)),
          factorColor(`[${relation.nextRoundMatchFactor}]`),
        ]);
        break;
      case 'one-to-nothing':
        rows.push([
          roundColor(pad(relation.previousRound.name, colWidth)),
          arrowColor('──▶'),
          roundColor(pad(round.name, colWidth)),
          arrowColor('──▶'),
          labelColor(pad('END', colWidth)),
          factorColor(`[${relation.previousRoundMatchFactor}]`),
        ]);
        break;
      case 'one-to-one':
        rows.push([
          roundColor(pad(relation.previousRound.name, colWidth)),
          arrowColor('──▶'),
          roundColor(pad(round.name, colWidth)),
          arrowColor('──▶'),
          roundColor(pad(relation.nextRound.name, colWidth)),
          factorColor(`[Prev: ${relation.previousRoundMatchFactor}, Next: ${relation.nextRoundMatchFactor}]`),
        ]);
        break;
      case 'two-to-one':
        rows.push([
          roundColor(pad(relation.previousUpperRound.name, colWidth)),
          arrowColor(' │ '),
          roundColor(pad(relation.previousLowerRound.name, colWidth)),
          arrowColor('──▶'),
          roundColor(pad(round.name, colWidth)),
          arrowColor('──▶'),
          roundColor(pad(relation.nextRound.name, colWidth)),
          factorColor(
            `[Upper: ${relation.previousUpperRoundMatchFactor}, Lower: ${relation.previousLowerRoundMatchFactor}, Next: ${relation.nextRoundMatchFactor}]`,
          ),
        ]);
        break;
      case 'two-to-nothing':
        rows.push([
          roundColor(pad(relation.previousUpperRound.name, colWidth)),
          arrowColor('   │'),
          roundColor(pad(relation.previousLowerRound.name, colWidth)),
          arrowColor('   ▼'),
          roundColor(pad(round.name, colWidth)),
          arrowColor('──▶'),
          labelColor(pad('END', colWidth)),
          factorColor(
            `[Upper: ${relation.previousUpperRoundMatchFactor}, Lower: ${relation.previousLowerRoundMatchFactor}]`,
          ),
        ]);
        break;
    }
  }

  // Print header
  const divider = (label: string) => {
    // eslint-disable-next-line no-control-regex
    const width = rows[0]?.reduce((w, col) => w + col.replace(/\x1b\[[0-9;]*m/g, '').length + 2, 0) || 60;
    return `\n${'='.repeat(width)}\n${labelColor(label)}\n${'='.repeat(width)}\n`;
  };
  console.log(divider('Bracket Structure'));

  // Print rows
  for (const row of rows) {
    console.log(row.join(' '));
  }
  console.log();
};
