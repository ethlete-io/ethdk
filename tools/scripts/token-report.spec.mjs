import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeTranscript } from './token-report.mjs';

const line = (o) => JSON.stringify(o);
const usage = (i, cr, cc, o) => ({
  input_tokens: i,
  cache_read_input_tokens: cr,
  cache_creation_input_tokens: cc,
  output_tokens: o,
});

const fixture = [
  line({
    type: 'assistant',
    message: {
      id: 'm1',
      usage: usage(2, 100, 900, 5),
      content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/a.ts' } }],
    },
  }),
  line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: 'x'.repeat(500) }] } }),
  line({
    type: 'assistant',
    message: {
      id: 'm2',
      usage: usage(1, 1000, 10, 7),
      content: [{ type: 'tool_use', id: 't2', name: 'Read', input: { file_path: '/a.ts' } }],
    },
  }),
  line({ type: 'assistant', message: { id: 'm2', usage: usage(1, 1000, 10, 9), content: [] } }),
  line({
    type: 'user',
    message: {
      content: [{ type: 'tool_result', tool_use_id: 't2', content: [{ type: 'text', text: 'y'.repeat(50) }] }],
    },
  }),
].join('\n');

test('sums usage once per request, reports start cost, large results and repeated reads', () => {
  const a = analyzeTranscript(fixture);
  assert.equal(a.requests, 2);
  assert.equal(a.output, 14);
  assert.equal(a.cacheRead, 1100);
  assert.equal(a.start, 1002);
  assert.deepEqual(
    a.topResults.map((r) => [r.tool, r.chars]),
    [
      ['Read', 500],
      ['Read', 50],
    ],
  );
  assert.deepEqual(a.topReads, [['/a.ts', 2]]);
});
