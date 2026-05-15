import '../../../test-helpers';
import { StreamPlayerErrorComponent } from './stream-player-error.component';

describe('StreamPlayerErrorComponent', () => {
  it('has the et-stream-player-error selector', () => {
    const selector = (StreamPlayerErrorComponent as any).ɵcmp?.selectors;
    expect(JSON.stringify(selector)).toContain('et-stream-player-error');
  });

  it('uses ViewEncapsulation.None', () => {
    // encapsulation 2 = ViewEncapsulation.None
    const encapsulation = (StreamPlayerErrorComponent as any).ɵcmp?.encapsulation;
    expect(encapsulation).toBe(2);
  });
});
