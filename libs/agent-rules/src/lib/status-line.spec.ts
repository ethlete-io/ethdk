import { describe, expect, it } from 'vitest';
import {
  formatLine,
  isCiRotOf,
  lastSlice,
  planFilesOf,
  questionCount,
  queueCount,
  taskFields,
} from '../../content/mods/plugins/status-line/hooks/line';

const NOW = Date.parse('2026-11-19T12:00:00.000Z');
const slice = (name: string, written: string) => `# slice: ${name}\n# written: ${written}\nlibs/a\n`;

describe('status line', () => {
  it('takes the last slice block', () => {
    const content = slice('Eins (B1)', '2026-11-19T10:00:00.000Z') + slice('Zwei (B2)', '2026-11-19T11:18:00.000Z');
    expect(lastSlice(content, 0)?.name).toBe('Zwei (B2)');
    expect(taskFields(content, 0, NOW)).toEqual({ task: 'Zwei (B2)', minutes: 42 });
  });

  it('shows kein Slice once the slice is older than 2 h', () => {
    expect(taskFields(slice('Alt (B1)', '2026-11-19T09:00:00.000Z'), 0, NOW)).toEqual({ task: 'kein Slice' });
  });

  it('falls back to the file mtime without a written line', () => {
    expect(taskFields('# slice: X (B3)\nlibs/a\n', NOW - 5 * 60_000, NOW)).toEqual({ task: 'X (B3)', minutes: 5 });
  });

  it('yields no task for an empty or foreign file', () => {
    expect(taskFields('', 0, NOW)).toEqual({});
    expect(taskFields('libs/a\n', 0, NOW)).toEqual({});
  });

  it('counts queue lines under the queue heading only', () => {
    const text = [
      '### Andere',
      '1. **Nein (B9)** ⏳',
      '### Warteschlange',
      '1. **Auto-Weg-Modus (B608)** ⏳ offen',
      '2. **Statuszeile (B612)** ⏳ offen',
      'Prosa',
      '## Ende',
      '3. **Draussen (B7)** ⏳',
    ].join('\n');
    expect(queueCount(text)).toBe(2);
    expect(queueCount('')).toBe(0);
  });

  it('counts dash lines as open questions', () => {
    expect(questionCount('- eins\nText\n- zwei\n  - eingerückt\n')).toBe(2);
  });

  it('reads report.planFiles from the config', () => {
    expect(planFilesOf('{"report":{"planFiles":["a.md","b.md"]}}')).toEqual(['a.md', 'b.md']);
    expect(planFilesOf('{}')).toBeUndefined();
    expect(planFilesOf('{"report":{"planFiles":[1]}}')).toBeUndefined();
    expect(planFilesOf('nope')).toBeUndefined();
  });

  it('flags only a completed failure as CI rot', () => {
    expect(isCiRotOf('[{"conclusion":"failure","status":"completed"}]')).toBe(true);
    expect(isCiRotOf('[{"conclusion":"","status":"in_progress"}]')).toBe(false);
    expect(isCiRotOf('[{"conclusion":"success","status":"completed"}]')).toBe(false);
    expect(isCiRotOf('[]')).toBe(false);
    expect(isCiRotOf('garbage')).toBe(false);
  });

  it('formats the line and omits missing fields', () => {
    expect(formatLine({ task: 'Auto-Weg-Modus (B608)', minutes: 42, queue: 14, questions: 2 })).toBe(
      '▶ Auto-Weg-Modus (B608) · 42 min · 14 offen · ❓2',
    );
    expect(formatLine({ task: 'kein Slice', queue: 3, questions: 0, isCiRot: true })).toBe(
      '▶ kein Slice · 3 offen · ⛔ CI rot',
    );
    expect(formatLine({ minutes: 75 })).toBe('1 h 15 min');
    expect(formatLine({})).toBeNull();
  });
});
