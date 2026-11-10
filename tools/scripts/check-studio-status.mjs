import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const MAX_STAND_AGE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const utcDay = (y, m, d) => Date.UTC(y, m - 1, d);

export const studioStatusProblems = (text, today = new Date()) => {
  const problems = [];
  const lines = text.split('\n');
  const todayDay = utcDay(today.getFullYear(), today.getMonth() + 1, today.getDate());

  lines.forEach((line, i) => {
    const n = i + 1;
    if (line.startsWith('|') && line.includes('✅')) {
      const id = line.split('|')[1]?.trim() || '?';
      problems.push(
        `STATUS.md line ${n}: row ${id} has status ✅. Delete the done row in the commit that finishes it.`,
      );
    }
    if (/^#{2,}\s+Erledigt/.test(line)) {
      problems.push(`STATUS.md line ${n}: section "${line.replace(/^#+\s+/, '')}". Delete the Erledigt section.`);
    }
  });

  const stand = lines.findIndex((l) => /^Stand:/.test(l));
  const match = stand === -1 ? null : lines[stand].match(/^Stand:\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!match) {
    problems.push('STATUS.md has no "Stand: DD.MM.YYYY" line. Add it near the top.');
  } else {
    const age = Math.round((todayDay - utcDay(+match[3], +match[2], +match[1])) / DAY_MS);
    if (age > MAX_STAND_AGE_DAYS) {
      problems.push(
        `STATUS.md line ${stand + 1}: Stand ${match[0].slice(7).trim()} is ${age} days old (max ${MAX_STAND_AGE_DAYS}). Update the Stand date.`,
      );
    }
  }
  return problems;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = process.argv[2];
  const text = readFileSync(path === '-' || !path ? 0 : path, 'utf8');
  const problems = studioStatusProblems(text);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
}
