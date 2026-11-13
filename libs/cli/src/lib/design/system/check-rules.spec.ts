import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { CHECK_RULES } from './check-rules';
import { WARNING_RULES } from './render-check';

const RULE_ID = /'([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)'/gu;

const sourcesOf = () => [
  ...readdirSync(join(__dirname, 'rules'))
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .map((file) => join(__dirname, 'rules', file)),
  ...['render-check.ts', 'bespoke-controls.ts', 'action-lost.ts', 'arrow-anchor.ts'].map((file) =>
    join(__dirname, file),
  ),
];

describe('CHECK_RULES', () => {
  it('lists every rule id the rule files and the render script emit', () => {
    const emitted = sourcesOf().flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(RULE_ID)].flatMap((match) => match[1] ?? []),
    );
    const unlisted = [...new Set(emitted)].filter((id) => !(CHECK_RULES as readonly string[]).includes(id));

    expect(emitted.length).toBeGreaterThan(20);
    expect(unlisted).toEqual([]);
  });

  it('fails a new render rule that warns instead of failing with a rule baseline (ADR 0201)', () => {
    const predating = ['EMBED-SCALE', 'UNDEFINED-CLASS'];

    expect([...WARNING_RULES].filter((rule) => !predating.includes(rule))).toEqual([]);
  });
});
