import {
  AGENT_API_OP_CLASSES,
  AGENT_CONTRACT_V3,
  AGENT_CONTRACT_V3_OPS,
  parseAgentRequest,
  routesThroughApproval,
} from '@ethlete/timetrack';
import { describe, expect, it } from 'vitest';

describe('agent v3 contract, app side', () => {
  it('has a tool for every op the app answers', () => {
    expect([...AGENT_CONTRACT_V3_OPS].sort()).toEqual(Object.keys(AGENT_API_OP_CLASSES).sort());
  });

  it.each(AGENT_CONTRACT_V3.map((entry) => [entry.tool, entry] as const))(
    'parses the %s request the adapter posts, unchanged',
    (_name, { request, wire }) => {
      expect(parseAgentRequest({ ...(wire ?? request), client: 'Contract spec' })).toEqual({ ok: true, request });
    },
  );

  it.each(AGENT_CONTRACT_V3.map((entry) => [entry.tool, entry] as const))(
    'queues the %s request exactly when the adapter expects a receipt',
    (_name, { request, queues }) => {
      expect(routesThroughApproval(request)).toBe(queues);
    },
  );
});
