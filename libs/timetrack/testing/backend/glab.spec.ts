import { describe, expect, it } from 'vitest';
import { E2E_PROJECT_PATH, createFakeWorld } from '../world';
import { runFakeGlab } from './glab';

const MERGE_REQUESTS = `projects/${encodeURIComponent(E2E_PROJECT_PATH)}/merge_requests`;

const stateOf = () => ({ installed: true, logins: [{ host: 'gitlab.example.com', login: 'e2e' }] });

describe('runFakeGlab', () => {
  it('applies a write sent as a method and a JSON body on stdin', () => {
    const { backend } = createFakeWorld({});
    const result = runFakeGlab({
      backend,
      state: stateOf(),
      spec: {
        command: 'glab',
        args: ['api', '--hostname', 'gitlab.example.com', '--method', 'POST', '--input', '-', MERGE_REQUESTS],
        stdin: JSON.stringify({ source_branch: 'feat/x', target_branch: 'next', title: 'Draft: x' }),
      },
    });

    expect(result.code).toBe(0);
    expect(backend.gitlab.created.map((created) => created.title)).toEqual(['Draft: x']);
  });

  it('reads with GET when no method is named', () => {
    const { backend } = createFakeWorld({});
    const result = runFakeGlab({
      backend,
      state: stateOf(),
      spec: { command: 'glab', args: ['api', '--hostname', 'gitlab.example.com', MERGE_REQUESTS] },
    });

    expect(JSON.parse(result.stdout)).toEqual([]);
    expect(backend.gitlab.created).toEqual([]);
  });
});
