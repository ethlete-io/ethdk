import {
  clearQueryDevtoolsFaults,
  isQueryDevtoolsFaultArmed,
  queryDevtoolsFaults,
  resolveQueryDevtoolsFaultForAttempt,
  setQueryDevtoolsFault,
  EMPTY_QUERY_DEVTOOLS_FAULT,
} from './query-devtools-faults';

const target = { clientName: 'api', method: 'GET', url: 'https://api.test/posts' };

describe('query devtools faults', () => {
  afterEach(() => clearQueryDevtoolsFaults());

  describe('setQueryDevtoolsFault', () => {
    it('should arm a client and keep unset fields at their default', () => {
      setQueryDevtoolsFault({ clientName: 'api', patch: { latencyMs: 400 } });

      expect(queryDevtoolsFaults()['api']).toEqual({ ...EMPTY_QUERY_DEVTOOLS_FAULT, latencyMs: 400 });
    });

    it('should patch only the given fields of an already armed client', () => {
      setQueryDevtoolsFault({ clientName: 'api', patch: { latencyMs: 400 } });
      setQueryDevtoolsFault({ clientName: 'api', patch: { failRate: 50 } });

      expect(queryDevtoolsFaults()['api']).toEqual({ ...EMPTY_QUERY_DEVTOOLS_FAULT, latencyMs: 400, failRate: 50 });
    });

    it('should drop a client whose fault no longer has anything armed', () => {
      setQueryDevtoolsFault({ clientName: 'api', patch: { latencyMs: 400 } });
      setQueryDevtoolsFault({ clientName: 'api', patch: { latencyMs: 0 } });

      expect(queryDevtoolsFaults()['api']).toBeUndefined();
    });

    it('should not treat a status on its own as armed', () => {
      setQueryDevtoolsFault({ clientName: 'api', patch: { status: 500 } });

      expect(queryDevtoolsFaults()['api']).toBeUndefined();
      expect(isQueryDevtoolsFaultArmed({ ...EMPTY_QUERY_DEVTOOLS_FAULT, status: 500 })).toBe(false);
    });

    it('should keep clients independent', () => {
      setQueryDevtoolsFault({ clientName: 'api', patch: { latencyMs: 400 } });
      setQueryDevtoolsFault({ clientName: 'auth', patch: { failNext: 1 } });

      clearQueryDevtoolsFaults('api');

      expect(queryDevtoolsFaults()['api']).toBeUndefined();
      expect(queryDevtoolsFaults()['auth']?.failNext).toBe(1);
    });
  });

  describe('resolveQueryDevtoolsFaultForAttempt', () => {
    it('should resolve nothing for a client with no fault armed', () => {
      expect(resolveQueryDevtoolsFaultForAttempt(target)).toBeNull();
    });

    it('should resolve latency without failing the attempt', () => {
      setQueryDevtoolsFault({ clientName: 'api', patch: { latencyMs: 250 } });

      expect(resolveQueryDevtoolsFaultForAttempt(target)).toEqual({ latencyMs: 250, status: null });
    });

    it('should fail exactly the next n attempts and count them down', () => {
      setQueryDevtoolsFault({ clientName: 'api', patch: { failNext: 2, status: 503 } });

      expect(resolveQueryDevtoolsFaultForAttempt(target)?.status).toBe(503);
      expect(queryDevtoolsFaults()['api']?.failNext).toBe(1);

      expect(resolveQueryDevtoolsFaultForAttempt(target)?.status).toBe(503);
      expect(resolveQueryDevtoolsFaultForAttempt(target)).toBeNull();
    });

    it('should keep the latency armed after a failNext budget is spent', () => {
      setQueryDevtoolsFault({ clientName: 'api', patch: { failNext: 1, latencyMs: 100 } });

      expect(resolveQueryDevtoolsFaultForAttempt(target)).toEqual({ latencyMs: 100, status: 503 });
      expect(resolveQueryDevtoolsFaultForAttempt(target)).toEqual({ latencyMs: 100, status: null });
    });

    it('should prefer the failNext budget over the rate while it lasts', () => {
      setQueryDevtoolsFault({ clientName: 'api', patch: { failNext: 1, failRate: 0 } });

      expect(resolveQueryDevtoolsFaultForAttempt(target)?.status).toBe(503);
    });

    it('should fail every attempt at a rate of 100', () => {
      setQueryDevtoolsFault({ clientName: 'api', patch: { failRate: 100, status: 500 } });

      expect(resolveQueryDevtoolsFaultForAttempt(target)?.status).toBe(500);
      expect(resolveQueryDevtoolsFaultForAttempt(target)?.status).toBe(500);
    });

    it('should roll the rate per attempt', () => {
      setQueryDevtoolsFault({ clientName: 'api', patch: { failRate: 40 } });

      const random = vi.spyOn(Math, 'random');

      random.mockReturnValue(0.39);
      expect(resolveQueryDevtoolsFaultForAttempt(target)?.status).toBe(503);

      random.mockReturnValue(0.4);
      expect(resolveQueryDevtoolsFaultForAttempt(target)?.status).toBeNull();

      random.mockRestore();
    });

    it('should only apply to the client it is armed on', () => {
      setQueryDevtoolsFault({ clientName: 'api', patch: { failRate: 100 } });

      expect(resolveQueryDevtoolsFaultForAttempt({ ...target, clientName: 'auth' })).toBeNull();
    });
  });
});
