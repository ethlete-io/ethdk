import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { failureCauseOf } from './failure-cause.mjs';

const fixture = (name) => readFileSync(join(import.meta.dirname, 'fixtures/run-0236', name), 'utf8');
const log = fixture('judge-server.log');
const png = Buffer.from('89504e470d0a1a0a0000000d494844520000058000000050080200000060684521', 'hex');
const failedShot = (headers = {}) => ({
  status: 500,
  headers: new Headers({ 'content-type': 'image/png', ...headers }),
});

describe('failureCauseOf on run 2026-11-25-0236', () => {
  it('takes the cause from the server log, not the failure picture', () => {
    const view = { part: 'elements/shell-app', sketch: 'elements/shell-app', variant: 'a', state: 'default' };
    const cause = failureCauseOf({ view, answer: failedShot(), body: png, log });
    assert.match(cause, /^500 Cannot find module '@system\/foundations\/logo'/);
    assert.ok(!cause.includes('PNG'));
  });

  it('names the missing text when the log has no line, never picture bytes', () => {
    const view = { part: 'elements/hero', sketch: 'elements/hero', variant: 'a', state: 'dune' };
    const cause = failureCauseOf({ view, answer: failedShot(), body: png, log });
    assert.match(cause, /keinen Fehlertext/);
    assert.ok(!cause.includes('PNG'));
  });

  it('prefers an x-et-error header', () => {
    const view = { part: 'elements/hero', sketch: 'elements/hero', variant: 'a', state: 'dune' };
    assert.equal(failureCauseOf({ view, answer: failedShot({ 'x-et-error': 'boom' }), body: png, log }), '500 boom');
  });

  it('keeps a text body', () => {
    const answer = { status: 404, headers: new Headers({ 'content-type': 'text/plain' }) };
    assert.equal(failureCauseOf({ view: {}, answer, body: Buffer.from('no such part\n'), log }), '404 no such part');
  });
});
