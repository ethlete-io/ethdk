import { DesignRefusalError } from '../../host/design';
import { refusalMessageOf } from './inventory';

describe('inventory labels', () => {
  it('shows the findings a refusal names under its message', () => {
    const refused = new DesignRefusalError({
      message: 'the check failed after the merge',
      reason: 'check-failed',
      findings: ['INLINE-SVG shared/chrome.ts: draws an <svg> inline'],
    });

    expect(refusalMessageOf(refused)).toBe(
      'the check failed after the merge\nINLINE-SVG shared/chrome.ts: draws an <svg> inline',
    );
  });
});
