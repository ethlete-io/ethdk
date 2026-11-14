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
