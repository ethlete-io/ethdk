import { signal } from '@angular/core';
import { withAutoRefresh, withLongPolling, withPageResetOnError, withPolling } from '../http/query-features';
import {
  describeQueryDevtoolsFeatures,
  formatQueryDevtoolsDuration,
  queryDevtoolsFnDetail,
} from './query-devtools-features';

describe('query devtools features', () => {
  describe('describeQueryDevtoolsFeatures', () => {
    it('should return nothing without features', () => {
      expect(describeQueryDevtoolsFeatures(undefined)).toEqual([]);
    });

    it('should describe a feature without a describer by its type alone', () => {
      expect(describeQueryDevtoolsFeatures([{ type: 'WITH_ARGS' }])).toEqual([{ type: 'WITH_ARGS', details: [] }]);
    });

    it('should describe how a polling feature was configured', () => {
      expect(describeQueryDevtoolsFeatures([withPolling({ interval: 5000 })])).toEqual([
        {
          type: 'WITH_POLLING',
          details: [
            { label: 'interval', value: '5s' },
            { label: 'execute initially', value: 'no' },
          ],
        },
      ]);
    });

    it('should tell a page reset by callback from one by signal', () => {
      const [byCallback] = describeQueryDevtoolsFeatures([withPageResetOnError({ reset: () => undefined })]);

      expect(byCallback?.details).toEqual([
        { label: 'resets', value: 'custom callback' },
        { label: 'when', value: 'page out of range' },
      ]);
    });
    it('should say a polling feature executes initially', () => {
      const [polling] = describeQueryDevtoolsFeatures([withPolling({ interval: 60_000, executeInitially: true })]);

      expect(polling?.details).toContainEqual({ label: 'execute initially', value: 'yes' });
    });

    it('should show the long polling delay, falling back to the default', () => {
      const nextArgs = () => null;
      const [custom, fallback] = describeQueryDevtoolsFeatures([
        withLongPolling({ nextArgs, delay: 2_000 }),
        withLongPolling({ nextArgs }),
      ]);

      expect(custom?.details).toContainEqual({ label: 'delay', value: '2s' });
      expect(fallback?.details).toContainEqual({ label: 'delay', value: '250ms' });
    });

    it('should say an auto refresh ignores manual only execution only when it does', () => {
      const trigger = signal(0);
      const [plain, ignoring] = describeQueryDevtoolsFeatures([
        withAutoRefresh({ onSignalChanges: [trigger] }),
        withAutoRefresh({ onSignalChanges: [trigger, trigger], ignoreOnlyManualExecution: true }),
      ]);

      expect(plain?.details).toEqual([{ label: 'signals', value: '1' }]);
      expect(ignoring?.details).toEqual([
        { label: 'signals', value: '2' },
        { label: 'ignores manual only', value: 'yes' },
      ]);
    });

    it('should show where a page reset by signal resets to, and a custom condition', () => {
      const [byDefault, custom] = describeQueryDevtoolsFeatures([
        withPageResetOnError({ page: signal(3) }),
        withPageResetOnError({ page: signal(3), resetTo: 0, when: () => true }),
      ]);

      expect(byDefault?.details).toEqual([
        { label: 'resets', value: 'page signal' },
        { label: 'reset to', value: '1' },
        { label: 'when', value: 'page out of range' },
      ]);
      expect(custom?.details).toEqual([
        { label: 'resets', value: 'page signal' },
        { label: 'reset to', value: '0' },
        { label: 'when', value: 'custom' },
      ]);
    });
  });

  describe('formatQueryDevtoolsDuration', () => {
    it('should render a duration in its largest whole unit', () => {
      expect(formatQueryDevtoolsDuration(500)).toBe('500ms');
      expect(formatQueryDevtoolsDuration(1500)).toBe('1.5s');
      expect(formatQueryDevtoolsDuration(60_000)).toBe('1m');
      expect(formatQueryDevtoolsDuration(15 * 60_000)).toBe('15m');
      expect(formatQueryDevtoolsDuration(86_400_000)).toBe('24h');
    });
  });

  describe('queryDevtoolsFnDetail', () => {
    it('should name a declared function', () => {
      const reportError = () => undefined;

      expect(queryDevtoolsFnDetail(reportError, 'handler')).toEqual([{ label: 'handler', value: 'reportError' }]);
    });

    it('should skip a lambda named after the option it was passed as', () => {
      const options = { handler: () => undefined };

      expect(queryDevtoolsFnDetail(options.handler, 'handler')).toEqual([]);
    });

    it('should skip a missing function', () => {
      expect(queryDevtoolsFnDetail(undefined, 'handler')).toEqual([]);
    });
  });
});
