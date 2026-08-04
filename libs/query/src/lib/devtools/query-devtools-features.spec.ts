import { withPageResetOnError, withPolling } from '../http/query-features';
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
