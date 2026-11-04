const ROW = /^\|\s*([A-Z][A-Za-z0-9-]*)\s*\|(.*)$/;
const FINDING_REFS = /Bef\.\s*([\d/,\s–-]+)/g;
const DONE = '✅';

export const findingNumbers = (text) => {
  const numbers = new Set();
  for (const match of text.matchAll(FINDING_REFS)) {
    for (const part of match[1].split(/[/,\s]+/).filter(Boolean)) {
      const range = part.split(/[–-]/).filter(Boolean).map(Number);
      if (range.length === 2 && range[1] - range[0] < 50) {
        for (let n = range[0]; n <= range[1]; n++) numbers.add(n);
      } else if (range.length >= 1 && !Number.isNaN(range[0])) {
        numbers.add(range[0]);
      }
    }
  }
  return numbers;
};

export const parseStatusRows = (statusText) =>
  statusText.split('\n').flatMap((line) => {
    const match = ROW.exec(line);
    if (!match || match[1] === 'ID') return [];
    const cells = match[2].split('|').map((cell) => cell.trim());
    if (cells.length < 2) return [];
    return [{ id: match[1], text: cells[0], done: cells[1].startsWith(DONE), findings: findingNumbers(cells[0]) }];
  });
