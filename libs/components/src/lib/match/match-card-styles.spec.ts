import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const css = readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, 'match-card.component.css'), 'utf8');

describe('match-card.component.css padding tokens', () => {
  it.each(['compact', 'expanded', 'minimal'])(
    'registers --et-match-card-%s-padding as a length list, so it takes a block and an inline value',
    (density) => {
      const body = css.match(new RegExp(`@property --et-match-card-${density}-padding\\s*\\{([^}]*)\\}`))?.[1] ?? '';

      expect(body).toContain("syntax: '<length>+';");
    },
  );
});

describe('match-card.component.css font tokens', () => {
  it.each([
    'meta-font-size',
    'versus-font-size',
    'games-font-size',
    'name-font-weight',
    'winner-name-font-weight',
    'score-font-weight',
    'outcome-font-weight',
    'status-font-weight',
  ])('registers --et-match-card-%s and reads it', (token) => {
    expect(css).toMatch(new RegExp(`@property --et-match-card-${token}\\s*\\{`));
    expect(css).toContain(`var(--et-match-card-${token})`);
  });

  it.each(['font-family', 'score-font-family'])('reads --et-match-card-%s with an inherit fallback', (token) => {
    expect(css).toContain(`var(--et-match-card-${token}, inherit)`);
  });
});

describe('match-card.component.css participant country line', () => {
  it('lays the country line out as a flex row of its own, not as the subtitle block', () => {
    expect(css).toContain('display: var(--_et-match-card-country-display, none);');
    expect(css.match(/--_et-match-card-country-display: flex;/g)).toHaveLength(2);
  });

  it('pins each side to start alignment, so a centered page cannot center the loser row', () => {
    const side = css.match(/\.et-match-card-side \{([^}]*)\}/)?.[1] ?? '';

    expect(side).toContain('text-align: start;');
  });
});
