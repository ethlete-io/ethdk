import { describe, expect, it } from 'vitest';
import { STUDIO_LABELS } from './studio-labels';

describe('STUDIO_LABELS', () => {
  it('labels the Sketches variant button Wählen and the merge view button Merge', () => {
    expect(STUDIO_LABELS.sketches.merge).toBe('Wählen');
    expect(STUDIO_LABELS.merge.merge).toBe('Merge');
  });
});
