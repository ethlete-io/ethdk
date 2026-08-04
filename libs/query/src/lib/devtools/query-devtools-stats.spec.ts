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

  describe('run history', () => {
    it('should start with no runs', () => {
      expect(createQueryDevtoolsStats().runs()).toEqual([]);
    });

    it('should open a run for an execution that reached the network', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: true, body: { a: 1 } });

      const [run] = recorder.runs();

      expect(recorder.runs().length).toBe(1);
      expect(run?.index).toBe(1);
      expect(run?.status).toBe('pending');
      expect(run?.endedAt).toBe(null);
      expect(run?.didRequest).toBe(true);
      expect(run?.sentBytes).toBe(JSON.stringify({ a: 1 }).length);
    });

    it('should not open a run for an execution answered without a request', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: false });

      expect(recorder.runs()).toEqual([]);
      expect(recorder.current().executions).toBe(1);
    });

    it('should close the open run with the response it received', () => {
      const recorder = createQueryDevtoolsStats();
      const headers = new HttpHeaders({ 'content-length': '42' });

      recorder.recordExecution({ didRequest: true });
      recorder.recordResponse({ headers, body: { a: 1 } });

      const [run] = recorder.runs();

      expect(recorder.runs().length).toBe(1);
      expect(run?.status).toBe('success');
      expect(run?.endedAt).not.toBe(null);
      expect(run?.receivedBytes).toBe(42);
      expect(run?.response).toEqual({ a: 1 });
      expect(run?.hasResponse).toBe(true);
    });

    it('should close the open run as failed on an error', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: true });
      recorder.recordError();

      const [run] = recorder.runs();

      expect(recorder.runs().length).toBe(1);
      expect(run?.status).toBe('error');
      expect(run?.endedAt).not.toBe(null);
      expect(run?.hasResponse).toBe(false);
    });

    it('should record a response no run was waiting for as an instant', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: false });
      recorder.recordResponse({ body: { a: 1 } });

      const [run] = recorder.runs();

      expect(recorder.runs().length).toBe(1);
      expect(run?.status).toBe('success');
      expect(run?.didRequest).toBe(false);
      expect(run?.startedAt).toBe(run?.endedAt);
      expect(run?.response).toEqual({ a: 1 });
    });

    it('should abort a run whose query requested again before it ended', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: true });
      recorder.recordExecution({ didRequest: true });

      const [first, second] = recorder.runs();

      expect(first?.status).toBe('aborted');
      expect(first?.endedAt).not.toBe(null);
      expect(second?.status).toBe('pending');
    });

    it('should close the newest open run, leaving an aborted one alone', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: true });
      recorder.recordExecution({ didRequest: true });
      recorder.recordResponse({ body: null });

      const [first, second] = recorder.runs();

      expect(first?.status).toBe('aborted');
      expect(second?.status).toBe('success');
    });

    it('should keep the run index climbing past the runs it dropped', () => {
      const recorder = createQueryDevtoolsStats();

      for (let i = 0; i < 30; i++) {
        recorder.recordExecution({ didRequest: true });
        recorder.recordResponse({ body: null });
      }

      const runs = recorder.runs();

      expect(runs.length).toBe(25);
      expect(runs[0]?.index).toBe(6);
      expect(runs[runs.length - 1]?.index).toBe(30);
    });

    it('should only retain the response bodies of the newest runs', () => {
      const recorder = createQueryDevtoolsStats();

      for (let i = 0; i < 8; i++) {
        recorder.recordExecution({ didRequest: true });
        recorder.recordResponse({ body: { run: i } });
      }

      const withBody = recorder.runs().filter((run) => run.hasResponse);

      expect(withBody.length).toBe(5);
      expect(withBody[0]?.response).toEqual({ run: 3 });
      expect(withBody[4]?.response).toEqual({ run: 7 });
      // A dropped body reads the same as one that never arrived, so nothing renders a stale response.
      expect(recorder.runs()[0]?.response).toBe(null);
    });

    it('should not count a run without a body against the retained window', () => {
      const recorder = createQueryDevtoolsStats();

      for (let i = 0; i < 6; i++) {
        recorder.recordExecution({ didRequest: true });
        recorder.recordError();
      }

      recorder.recordExecution({ didRequest: true });
      recorder.recordResponse({ body: { a: 1 } });

      expect(recorder.runs().filter((run) => run.hasResponse).length).toBe(1);
    });

    it('should keep the url each run went to', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: true, url: '/posts?page=1' });
      recorder.recordResponse({ body: null });
      recorder.recordExecution({ didRequest: true, url: '/posts?page=2' });
      recorder.recordResponse({ body: null });

      expect(recorder.runs().map((run) => run.url)).toEqual(['/posts?page=1', '/posts?page=2']);
    });

    it('should attribute a run it did not request to the url the query was last pointed at', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: false, url: '/posts?page=1' });
      recorder.recordResponse({ body: null });

      expect(recorder.runs()[0]?.url).toBe('/posts?page=1');
    });

    it('should clear the runs and restart the numbering on reset', () => {
      const recorder = createQueryDevtoolsStats();

      recorder.recordExecution({ didRequest: true });
      recorder.recordResponse({ body: null });
      recorder.reset();

      expect(recorder.runs()).toEqual([]);

      recorder.recordExecution({ didRequest: true });

      expect(recorder.runs()[0]?.index).toBe(1);
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
