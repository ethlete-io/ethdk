import { describe, expect, it } from 'vitest';
import { KNOWN_UNBOUND_INPUTS } from './unbound-input-known';

describe('KNOWN_UNBOUND_INPUTS', () => {
  // The system view binds its comment inputs, so the known-unbound list holds none of them.
  it('lists no input of the system page the system view binds', () => {
    const listed = KNOWN_UNBOUND_INPUTS.filter((known) =>
      known.file.endsWith('system-page/system-page.component.ts'),
    ).map((known) => known.input);

    for (const bound of ['commentMode', 'draft', 'send', 'reason']) expect(listed).not.toContain(bound);
  });
});
