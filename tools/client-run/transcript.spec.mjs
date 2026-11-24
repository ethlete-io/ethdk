import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { designCommandOf, leftRefusalsOf, readTranscript } from './transcript.mjs';

const excerpt = readFileSync(join(import.meta.dirname, 'fixtures/transcript-excerpt.jsonl'), 'utf8');

describe('designCommandOf', () => {
  it('names the design subcommand however the cli is called', () => {
    assert.equal(designCommandOf('$ET design sketch ready components/title-card --product tomflix'), 'sketch ready');
    assert.equal(
      designCommandOf('cd x; node node_modules/@ethlete/cli/src/index.js design check --product t'),
      'check',
    );
    assert.equal(designCommandOf('npx et design shot components/title-card --states'), 'shot');
    assert.equal(designCommandOf('ls design'), null);
  });
});

describe('readTranscript', () => {
  it('reads the design calls and the last message of a real run', () => {
    const transcript = readTranscript(excerpt);

    assert.deepEqual(
      transcript.calls.map((call) => [call.key, call.failed]),
      [
        ['sketch list', false],
        ['sketch ready', false],
      ],
    );
    assert.match(transcript.result.text, /^Der Sketch der Titelkarte ist fertig/);
  });

  it('does not read help text that mentions a refusal as a failed call', () => {
    const [list] = readTranscript(excerpt).calls;

    assert.match(list.output, /refuses/);
    assert.equal(list.failed, false);
  });
});

describe('leftRefusalsOf', () => {
  const failing = (text, id) => text.replace(new RegExp(`("tool_use_id":"${id}"[^}]*"is_error":)false`), '$1true');

  it('keeps a failed call that no later call of the same command passed', () => {
    const transcript = readTranscript(excerpt);
    const ready = transcript.calls[1];
    const left = leftRefusalsOf(readTranscript(failing(excerpt, ready.id)));

    assert.deepEqual(
      left.map((call) => call.key),
      ['sketch ready'],
    );
  });

  it('drops nothing from a run whose calls all passed', () => {
    assert.deepEqual(leftRefusalsOf(readTranscript(excerpt)), []);
  });
});
