import {
  armQueryDevtoolsOverrideTransfer,
  countUnresolvedQueryDevtoolsOverrides,
  parseQueryDevtoolsOverrideTransfer,
  serializeQueryDevtoolsOverrideTransfer,
} from './query-devtools-override-transfer';
import { createQueryDevtoolsOverrides } from './query-devtools-overrides';

describe('query devtools override transfer', () => {
  describe('serializeQueryDevtoolsOverrideTransfer', () => {
    it('should round-trip an armed set through the clipboard text', () => {
      const recorder = createQueryDevtoolsOverrides();

      recorder.arm({ type: 'set', path: ['a'], value: 1 });
      recorder.arm({ type: 'booleanFlip', path: ['b', 0, 'c'] });

      const parsed = parseQueryDevtoolsOverrideTransfer(serializeQueryDevtoolsOverrideTransfer(recorder.list()));

      expect(parsed).toEqual({
        ok: true,
        skipped: 0,
        ops: [
          { type: 'set', path: ['a'], value: 1 },
          { type: 'booleanFlip', path: ['b', 0, 'c'] },
        ],
      });
    });

    it('should carry the source bearing when one is given', () => {
      const text = serializeQueryDevtoolsOverrideTransfer([{ id: '1', op: { type: 'booleanFlip', path: [] } }], {
        id: 'query-1',
        url: 'https://api.example.com/matches',
      });

      const parsed = parseQueryDevtoolsOverrideTransfer(text);

      expect(parsed.ok && parsed.source).toEqual({ id: 'query-1', url: 'https://api.example.com/matches' });
    });
  });

  describe('parseQueryDevtoolsOverrideTransfer', () => {
    it('should accept a bare array of ops, for a set trimmed by hand out of a ticket', () => {
      const parsed = parseQueryDevtoolsOverrideTransfer('[{ "type": "booleanFlip", "path": ["done"] }]');

      expect(parsed.ok && parsed.ops).toEqual([{ type: 'booleanFlip', path: ['done'] }]);
    });

    it('should skip an op type this build cannot replay rather than failing the whole paste', () => {
      const text = JSON.stringify({
        ops: [
          { type: 'booleanFlip', path: ['a'] },
          { type: 'timeTravel', path: ['b'] },
        ],
      });

      const parsed = parseQueryDevtoolsOverrideTransfer(text);

      expect(parsed.ok && parsed).toMatchObject({ skipped: 1, ops: [{ type: 'booleanFlip', path: ['a'] }] });
    });

    it('should reject a payload whose ops are all unreplayable', () => {
      const parsed = parseQueryDevtoolsOverrideTransfer('{ "ops": [{ "type": "timeTravel", "path": [] }] }');

      expect(parsed).toEqual({ ok: false, reason: 'None of those ops can be replayed by this build' });
    });

    it('should reject an op whose path is not a list of keys and indices', () => {
      const parsed = parseQueryDevtoolsOverrideTransfer('{ "ops": [{ "type": "set", "path": "a.b", "value": 1 }] }');

      expect(parsed.ok).toBe(false);
    });

    it('should reject a copied value rather than reading it as a set', () => {
      const parsed = parseQueryDevtoolsOverrideTransfer('{ "id": 1, "name": "a" }');

      expect(parsed).toEqual({ ok: false, reason: 'The clipboard does not hold a copied override set' });
    });

    it('should reject text that is not JSON at all', () => {
      expect(parseQueryDevtoolsOverrideTransfer('response.items[0].id')).toEqual({
        ok: false,
        reason: 'The clipboard does not hold valid JSON',
      });
    });

    it('should reject empty clipboard text', () => {
      expect(parseQueryDevtoolsOverrideTransfer('   ')).toEqual({ ok: false, reason: 'The clipboard is empty' });
    });
  });

  describe('countUnresolvedQueryDevtoolsOverrides', () => {
    it('should count only the ops whose path the target response cannot resolve', () => {
      const ops = [
        { type: 'booleanFlip' as const, path: ['done'] },
        { type: 'booleanFlip' as const, path: ['missing', 'deep'] },
      ];

      expect(countUnresolvedQueryDevtoolsOverrides(ops, { done: true })).toBe(1);
    });

    it('should count an op resolvable only because an earlier one made its path exist as resolved', () => {
      const ops = [
        { type: 'set' as const, path: ['nested'], value: { flag: false } },
        { type: 'booleanFlip' as const, path: ['nested', 'flag'] },
      ];

      expect(countUnresolvedQueryDevtoolsOverrides(ops, {})).toBe(0);
    });
  });

  describe('armQueryDevtoolsOverrideTransfer', () => {
    it('should arm a pasted set on top of what is already armed', () => {
      const recorder = createQueryDevtoolsOverrides();

      recorder.arm({ type: 'set', path: ['a'], value: 1 });
      armQueryDevtoolsOverrideTransfer(recorder, [{ type: 'booleanFlip', path: ['b'] }]);

      expect(recorder.list().map((entry) => entry.op.type)).toEqual(['set', 'booleanFlip']);
    });
  });
});
