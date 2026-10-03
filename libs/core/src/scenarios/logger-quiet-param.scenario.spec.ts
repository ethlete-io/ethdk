import { provideLocationMocks } from '@angular/common/testing';
import { inject } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { createLogger } from '../index';
import { useScenario } from './harness';

describe('logger quiet param scenarios', () => {
  const scenario = useScenario({
    providers: [provideRouter([{ path: '', children: [] }]), provideLocationMocks()],
  });

  it('goes quiet on a bare et-logger-quiet param', async () => {
    const s = scenario();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    try {
      const logger = s.run(() => createLogger({ scope: 'SCENARIO', feature: 'Logger' }));
      await s.run(() => inject(Router)).navigateByUrl('/?et-logger-quiet');
      await s.settle();

      logger.log('hidden');
      logger.warn('hidden');
      logger.error('hidden');

      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
