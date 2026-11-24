import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ResolvedProduct } from '../resolve-product';
import { stillMotionStatesOf } from './still-motion';

// The foundations/logo part of client run 2026-11-24-1109, sketch variant a, as the agent left it at ready.
const FIXTURE = join(__dirname, '__fixtures__/logo-1109');
const LOGO_1109 = readFileSync(join(FIXTURE, 'logo.ts.txt'), 'utf8');
const CSS_1109 = readFileSync(join(FIXTURE, 'logo.css'), 'utf8');

const productOf = (source: string, cssSource: string | null) =>
  ({ parts: [{ file: '/p/logo.ts', origin: 'product', source, cssSource }] }) as unknown as ResolvedProduct;

const rulesOf = (source: string, cssSource: string | null) =>
  stillMotionStatesOf(productOf(source, cssSource)).map(({ rule, states }) => ({ rule, states }));

describe('stillMotionStatesOf', () => {
  it('names the motion state of the 1109 logo, which nothing animates', () => {
    expect(rulesOf(LOGO_1109, CSS_1109)).toEqual([{ rule: 'MOTION-STILL', states: ['motion'] }]);
  });

  it('passes the logo once its styles animate the mark', () => {
    const animated = `${CSS_1109}\n.logo-stage svg { animation: logo-in 600ms ease-out both; }\n@keyframes logo-in { from { opacity: 0; } }\n`;

    expect(rulesOf(LOGO_1109, animated)).toEqual([]);
  });

  it('passes a part that animates through the Web Animations API', () => {
    expect(rulesOf(`${LOGO_1109}\nmark.animate([{ opacity: 0 }, { opacity: 1 }], 600);\n`, CSS_1109)).toEqual([]);
  });

  it('leaves a part without a motion state alone', () => {
    expect(rulesOf(LOGO_1109.replace(/\bmotion\b/gu, 'stage'), CSS_1109)).toEqual([]);
  });
});
