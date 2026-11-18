import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, 'match-participant.component.css'), 'utf8');

describe('match-participant.component.css emblem frame tokens', () => {
  it.each([
    ['emblem-radius', "'<length-percentage>'", '50%'],
    ['emblem-border-width', "'<length>'", '0px'],
  ])('registers --et-match-participant-%s with today’s look as its default', (token, syntax, initial) => {
    const body = css.match(new RegExp(`@property --et-match-participant-${token}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

    expect(body).toContain(`syntax: ${syntax};`);
    expect(body).toContain(`initial-value: ${initial};`);
  });

  it('reads the TBD frame border from its own tokens, falling back to the emblem border', () => {
    expect(css).toContain(
      'var(--et-match-participant-tbd-emblem-border-width, var(--et-match-participant-emblem-border-width))',
    );
    expect(css).toContain('var(--et-match-participant-tbd-emblem-border-style, solid)');
  });
});
