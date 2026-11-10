const TABLE_ROW = /^\s*\|/;

export const unpaddedLength = (text) =>
  text
    .split('\n')
    .map((line) => (TABLE_ROW.test(line) ? line.replace(/ {2,}\|/g, ' |').replace(/-{3,}/g, '--') : line))
    .join('\n').length;

export const wideCells = (text, cap) =>
  text
    .split('\n')
    .filter((line) => TABLE_ROW.test(line) && !/^[\s|:-]+$/.test(line))
    .flatMap((line) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      const widest = Math.max(...cells.map((cell) => cell.length));
      return widest > cap ? [{ row: cells[0], length: widest }] : [];
    });
