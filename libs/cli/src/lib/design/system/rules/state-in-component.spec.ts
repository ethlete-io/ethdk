import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { phaseUnionsOf, statesNotInComponentOf } from './state-in-component';

const COMMENT_DRAFT_COMPONENT = `import { Component, input } from '@angular/core';
export type CommentSendPhase = 'busy' | 'error' | 'rejected';
type Size = 'sm' | 'md';
@Component({ selector: 'app-comment-draft', template: '' })
export class CommentDraftComponent {
  public phase = input<CommentSendPhase | null>(null);
  public size = input<Size>('md');
}
`;

const partWith = (states: string) =>
  `import { definePart } from '@design-system';\nexport default definePart({ note: '', implements: 'src/app/comment-draft.component.ts', states: ${states}, render: () => ({ body: '', styles: '' }) });\n`;

const problemsWith = (states: string, component = COMMENT_DRAFT_COMPONENT) => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });
  mkdirSync(join(target, 'src/app'), { recursive: true });
  writeFileSync(join(target, 'src/app/comment-draft.component.ts'), component);

  const file = join(target, DESIGN_DIR, 'acme/components/comment-draft/comment-draft.ts');

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, partWith(states));

  const product = resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

  return statesNotInComponentOf(product).map(({ rule, message }) => `${rule} ${message}`);
};

describe('phaseUnionsOf', () => {
  it('reads the phase and state unions of signal inputs, not other unions', () => {
    expect(phaseUnionsOf(COMMENT_DRAFT_COMPONENT)).toEqual([
      { name: 'CommentSendPhase', values: ['busy', 'error', 'rejected'] },
    ]);
  });

  it('reads an inline union on an input named state', () => {
    expect(phaseUnionsOf(`class A { public state = input<'idle' | 'saving'>('idle'); }`)).toEqual([
      { name: 'state', values: ['idle', 'saving'] },
    ]);
  });
});

describe('statesNotInComponentOf', () => {
  it('flags the comment-draft state named sending that draws the busy phase (finding 311)', () => {
    expect(
      problemsWith(`{ empty: {}, sending: { text: 'Tonal wirkt neben filled zu blass.', phase: 'busy' } }`),
    ).toEqual([
      `STATE-NOT-IN-COMPONENT state "sending" sets phase: 'busy' of CommentSendPhase in src/app/comment-draft.component.ts (busy | error | rejected) - name the state "busy" as the app does`,
    ]);
  });

  it('flags a state named after another phase than the one it sets', () => {
    expect(problemsWith(`{ error: { phase: 'busy' } }`)).toHaveLength(1);
  });

  it('accepts states named after their phase, with a detail suffix, or setting no phase', () => {
    expect(
      problemsWith(
        `{ empty: {}, typed: { text: 'x', size: 'sm' }, busy: { phase: 'busy' }, 'error-long': { phase: 'error' } }`,
      ),
    ).toEqual([]);
  });

  it('says nothing when the linked component does not exist', () => {
    const states = `{ sending: { phase: 'busy' } }`;

    expect(problemsWith(states, '')).toEqual([]);
  });
});
