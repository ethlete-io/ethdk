import { createGqlMutationViaPost, gql } from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

describe('gql scan 2026-10-03', () => {
  describe('operationName extraction', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('sends no operation name for an anonymous mutation whose payload selects a Relay-style query field', () => {
      const s = scenario();
      s.api.on('POST', '/', () => ({ body: { data: { createUser: { query: { viewer: { id: '1' } } } } } }));

      const createUser = createGqlMutationViaPost(s.clientRef)<{
        response: { createUser: unknown };
        variables: { input: { name: string } };
      }>(gql`
        mutation ($input: CreateUserInput!) {
          createUser(input: $input) {
            query
            viewer {
              id
            }
          }
        }
      `);

      const c = s.consumer();
      const mutation = c.run(() => createUser());
      mutation.execute({ args: { variables: { input: { name: 'Ada' } } } });
      s.tick();

      const req = s.api.requests[0];
      if (!req) throw new Error('expected a request');
      expect((req.body as { operationName?: string }).operationName).toBeUndefined();

      c.destroy();
    });
  });
});
