import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('surface interactive styles', () => {
  // The CLI design frame ships a copy; a core-only change does not run the cli specs, so the check lives here too.
  it('equal the copy the @ethlete/cli design frame ships', () => {
    expect(readFileSync(resolve(__dirname, '../../../../cli/design/web/surface-interactive.css'), 'utf8')).toBe(
      readFileSync(resolve(__dirname, 'surface-interactive-styles.component.css'), 'utf8'),
    );
  });
});
