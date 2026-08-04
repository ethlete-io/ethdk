import { HttpHeaders } from '@angular/common/http';
import { createQueryDevtoolsStats, measureQueryDevtoolsPayload, sumQueryDevtoolsStats } from './query-devtools-stats';

describe('query devtools stats', () => {
  describe('measureQueryDevtoolsPayload', () => {
    it('should read an exact size from the content-length header', () => {
      const headers = new HttpHeaders({ 'content-length': '2048' });

      expect(measureQueryDevtoolsPayload({ headers, body: { a: 1 } })).toEqual({ bytes: 2048, isExact: true });
    });

    it('should estimate a json body without a content-length header', () => {
      expect(measureQueryDevtoolsPayload({ body: { a: 1 } })).toEqual({
        bytes: JSON.stringify({ a: 1 }).length,
        isExact: false,
      });
    });

    it('should count a multi byte character by its utf-8 length', () => {
      expect(measureQueryDevtoolsPayload({ body: 'ä' }).bytes).toBe(2);
    });

    it('should read a binary body by its own size', () => {
      expect(measureQueryDevtoolsPayload({ body: new ArrayBuffer(64) }).bytes).toBe(64);
      expect(measureQueryDevtoolsPayload({ body: new Blob(['abcd']) }).bytes).toBe(4);
    });

    it('should report nothing for an empty or unserializable body', () => {
      const circular: Record<string, unknown> = {};
      circular['self'] = circular;

      expect(measureQueryDevtoolsPayload({ body: null }).bytes).toBe(0);
      expect(measureQueryDevtoolsPayload({ body: undefined }).bytes).toBe(0);
      expect(measureQueryDevtoolsPayload({ body: circular }).bytes).toBe(0);
    });
  });

  describe('createQueryDevtoolsStats', () => {
    it('should start empty', () => {
      const stats = createQueryDevtoolsStats().current();

      expect(stats.executions).toBe(0);
      expect(stats.requests).toBe(0);
      expect(stats.receivedBytes).toBe(0);
      expect(stats.hasEstimatedBytes).toBe(false);
      expect(stats.firstExecutedAt).toBe(null);
    });

    it('should count an execution that reached the network apart from one that did not', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: true });
      recorder.recordExecution({ didRequest: false });

      expect(recorder.current().executions).toBe(2);
      expect(recorder.current().requests).toBe(1);
      expect(recorder.current().firstExecutedAt).not.toBe(null);
    });

    it('should only count a sent body for an execution that reached the network', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: false, body: { a: 1 } });
      expect(recorder.current().sentBytes).toBe(0);

      recorder.recordExecution({ didRequest: true, body: { a: 1 } });
      expect(recorder.current().sentBytes).toBe(JSON.stringify({ a: 1 }).length);
      expect(recorder.current().hasEstimatedBytes).toBe(true);
    });

    it('should sum the received payload across responses', () => {
      const recorder = createQueryDevtoolsStats();
      const headers = new HttpHeaders({ 'content-length': '100' });

      recorder.recordExecution({ didRequest: true });
      recorder.recordResponse({ headers, body: { a: 1 } });
      recorder.recordExecution({ didRequest: true });
      recorder.recordResponse({ headers, body: { a: 1 } });

      const stats = recorder.current();

      expect(stats.responses).toBe(2);
      expect(stats.receivedBytes).toBe(200);
      expect(stats.hasEstimatedBytes).toBe(false);
      expect(stats.lastResponseAt).not.toBe(null);
    });

    it('should flag an estimate once a response arrives without a content-length header', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: true });
      recorder.recordResponse({ body: { a: 1 } });

      expect(recorder.current().hasEstimatedBytes).toBe(true);
    });

    it('should not flag an estimate for an empty response body', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: true });
      recorder.recordResponse({ body: null });

      expect(recorder.current().hasEstimatedBytes).toBe(false);
    });

    it('should measure a response against the execution that preceded it', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: true });
      recorder.recordResponse({ body: null });

      const stats = recorder.current();

      expect(stats.lastDurationMs).not.toBe(null);
      expect(stats.totalDurationMs).toBe(stats.lastDurationMs);
    });

    it('should leave a response without a preceding execution undated', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordResponse({ body: null });

      expect(recorder.current().lastDurationMs).toBe(null);
      expect(recorder.current().totalDurationMs).toBe(0);
    });

    it('should count errors', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: true });
      recorder.recordError();

      expect(recorder.current().errors).toBe(1);
      expect(recorder.current().responses).toBe(0);
    });

    it('should clear every counter on reset', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: true, body: { a: 1 } });
      recorder.recordResponse({ body: { a: 1 } });
      recorder.reset();

      const stats = recorder.current();

      expect(stats).toEqual({
        executions: 0,
        requests: 0,
        responses: 0,
        errors: 0,
        receivedBytes: 0,
        sentBytes: 0,
        hasEstimatedBytes: false,
        firstExecutedAt: null,
        lastResponseAt: null,
        lastDurationMs: null,
        totalDurationMs: 0,
      });
    });

    it('should not report a duration for the response after a reset', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: true });
      recorder.reset();
      recorder.recordResponse({ body: null });

      expect(recorder.current().lastDurationMs).toBe(null);
    });
  });

  describe('sumQueryDevtoolsStats', () => {
    it('should return empty stats without entries', () => {
      expect(sumQueryDevtoolsStats([undefined])).toEqual(sumQueryDevtoolsStats([]));
      expect(sumQueryDevtoolsStats([]).executions).toBe(0);
      expect(sumQueryDevtoolsStats([]).firstExecutedAt).toBe(null);
    });

    it('should add up the counters of every entry', () => {
      const headers = new HttpHeaders({ 'content-length': '10' });

      const first = createQueryDevtoolsStats();
      first.recordExecution({ didRequest: true });
      first.recordResponse({ headers, body: null });

      const second = createQueryDevtoolsStats();
      second.recordExecution({ didRequest: true });
      second.recordExecution({ didRequest: false });
      second.recordResponse({ body: { a: 1 } });

      const total = sumQueryDevtoolsStats([first, undefined, second]);

      expect(total.executions).toBe(3);
      expect(total.requests).toBe(2);
      expect(total.responses).toBe(2);
      expect(total.receivedBytes).toBe(10 + JSON.stringify({ a: 1 }).length);
      expect(total.hasEstimatedBytes).toBe(true);
    });

    it('should take the last duration from whichever entry responded last', () => {
      const older = createQueryDevtoolsStats();
      older.recordExecution({ didRequest: true });
      older.recordResponse({ body: null });

      const newer = createQueryDevtoolsStats();
      newer.recordExecution({ didRequest: true });
      newer.recordResponse({ body: null });

      const total = sumQueryDevtoolsStats([older, newer]);

      expect(total.lastResponseAt).toBe(Math.max(older.current().lastResponseAt!, newer.current().lastResponseAt!));
      expect(total.totalDurationMs).toBe(older.current().totalDurationMs + newer.current().totalDurationMs);
    });
  });
});
