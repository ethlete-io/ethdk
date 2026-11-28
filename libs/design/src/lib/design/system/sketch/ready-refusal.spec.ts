import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearReadyRefusal, recordedReadyRefusalOf, recordReadyRefusal } from './ready-refusal';

describe('recordedReadyRefusalOf', () => {
  let target = '';

  afterEach(() => rmSync(target, { recursive: true, force: true }));

  it('answers the refusal of the running round only, and nothing once cleared', () => {
    target = mkdtempSync(join(tmpdir(), 'ready-refusal-'));

    const productDir = join(target, '.ethlete/design/acme');
    const round = (key: string) => ({ key, title: '', note: '' });
    const first = { target: 'pages/system', rounds: [round('r1')] };
    const second = { ...first, rounds: [round('r1'), round('r2')] };

    recordReadyRefusal({ productDir, sketch: first, message: 'pages/system b: SHOT-NOT-VIEWED\n\nwhy - fix it' });

    expect(recordedReadyRefusalOf({ productDir, sketch: first })).toMatchObject({
      lines: ['pages/system b: SHOT-NOT-VIEWED', 'why - fix it'],
      round: 'r1',
    });
    expect(recordedReadyRefusalOf({ productDir, sketch: second })).toBeNull();

    clearReadyRefusal({ productDir, sketch: first });

    expect(recordedReadyRefusalOf({ productDir, sketch: first })).toBeNull();
  });
});
