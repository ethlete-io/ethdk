import { firstValueFrom } from 'rxjs';
import { streamDay$ } from './build-day';

class UnloadableWorker extends EventTarget {
  static created = 0;

  constructor() {
    super();
    UnloadableWorker.created++;
    setTimeout(() => this.dispatchEvent(new Event('error')));
  }

  postMessage() {
    return undefined;
  }
}

describe('the day build when its worker fails to load', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', UnloadableWorker);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('builds the day on the page instead of waiting for a reply', async () => {
    const day = await firstValueFrom(streamDay$({ events: [], options: { day: '2026-11-19' } }));
    const again = await firstValueFrom(streamDay$({ events: [], options: { day: '2026-11-19' } }));

    expect(day.rows).toBeDefined();
    expect(again.rows).toBeDefined();
    expect(UnloadableWorker.created).toBe(1);
  });
});
