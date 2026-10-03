import { describe, expect, it } from 'vitest';
import {
  isQueryDevtoolsEnabled,
  loadQueryDevtoolsSchema,
  provideQueryDevtools,
  queryDevtoolsSchemaState,
  seedQueryDevtoolsSchemaBody,
} from '../index';
import { useScenario } from './harness';

const CLIENT_NAME = 'devtools-scan-2026-10-03';

const SCHEMA = {
  components: {
    schemas: {
      Penalty: {
        type: 'object',
        properties: {
          points: { type: 'integer', maximum: -3 },
          code: { type: 'string', maxLength: 2 },
          reason: { type: 'string', minLength: 12 },
        },
      },
    },
  },
};

describe('devtools scan 2026-10-03', () => {
  const scenario = useScenario({
    name: CLIENT_NAME,
    clientOptions: { keepUnusedFor: 0 },
    providers: () => [provideQueryDevtools({ schema: () => SCHEMA })],
  });

  it('seeds a placeholder and a realistic body inside a maximum below zero and inside the declared lengths', async () => {
    const s = scenario();
    expect(isQueryDevtoolsEnabled()).toBe(true);

    loadQueryDevtoolsSchema(CLIENT_NAME);
    await s.settle();

    expect(queryDevtoolsSchemaState(CLIENT_NAME).status).toBe('ready');

    for (const style of ['placeholder', 'realistic'] as const) {
      const body = seedQueryDevtoolsSchemaBody(CLIENT_NAME, 'Penalty', style)?.body as {
        points: number;
        code: string;
        reason: string;
      };

      expect(body.points).toBeLessThanOrEqual(-3);
      expect(body.code.length).toBeLessThanOrEqual(2);
      expect(body.reason.length).toBeGreaterThanOrEqual(12);
    }
  });

});
