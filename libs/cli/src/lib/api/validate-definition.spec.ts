import { describe, expect, it } from 'vitest';
import { ApiDefinition } from './definition';
import { validateApiDefinition } from './validate-definition';

const BASE: ApiDefinition = { composeDir: 'development', services: ['app', 'db'], execService: 'app', port: 80 };

const problem = (extra: Record<string, unknown>) => {
  try {
    validateApiDefinition({ fileName: 'ethlete.apis.js', name: 'hub', api: { ...BASE, ...extra } as ApiDefinition });
  } catch (error) {
    return (error as Error).message;
  }

  return undefined;
};

describe('validateApiDefinition', () => {
  it('accepts a definition without the new fields and a complete one', () => {
    expect(problem({})).toBeUndefined();
    expect(
      problem({
        migrationsDir: 'database/migrations',
        checks: [
          { name: 'a', check: 'true', fix: 'true', service: 'db' },
          { name: 'b', check: 'true', host: true },
        ],
        profiles: {
          e2e: {
            seeds: ['fixtures'],
            health: { url: 'http://x', expect: 204 },
            snapshot: { service: 'db', databases: ['x'], save: 'dump', restore: 'load' },
          },
        },
      }),
    ).toBeUndefined();
  });

  it.each([
    [{ checks: {} }, 'hub.checks must be a list'],
    [{ checks: [{ name: '', check: 'true' }] }, 'hub.checks[0].name must be a non-empty string'],
    [
      {
        checks: [
          { name: 'a', check: 'true' },
          { name: 'a', check: 'true' },
        ],
      },
      'hub.checks[1].name "a" is declared twice',
    ],
    [{ checks: [{ name: 'a', check: '' }] }, 'hub.checks[0].check must be a shell line'],
    [
      {
        checks: [
          { name: 'a', check: 'true' },
          { name: 'b', check: 'true' },
          { name: 'c', check: 'true', fix: ['x'] },
        ],
      },
      'hub.checks[2].fix must be a shell line',
    ],
    [{ checks: [{ name: 'a', check: 'true', service: 'cache' }] }, 'hub.checks[0].service must be one of services'],
    [{ checks: [{ name: 'a', check: 'true', host: 'yes' }] }, 'hub.checks[0].host must be a boolean'],
    [{ profiles: { e2e: { seeds: [] } } }, 'hub.profiles.e2e.seeds must be a non-empty list'],
    [{ profiles: { e2e: { seeds: ['a'], health: { url: 1 } } } }, 'hub.profiles.e2e.health.url must be a string'],
    [
      { profiles: { e2e: { seeds: ['a'], health: { url: 'x', expect: 1.5 } } } },
      'hub.profiles.e2e.health.expect must be an integer',
    ],
    [
      { profiles: { e2e: { seeds: ['a'], snapshot: { service: 'db', databases: [], save: 's', restore: 'r' } } } },
      'hub.profiles.e2e.snapshot.databases must be a non-empty list',
    ],
    [
      { profiles: { e2e: { seeds: ['a'], snapshot: { service: 'db', databases: ['x'], save: 's' } } } },
      'hub.profiles.e2e.snapshot.restore must be a shell line',
    ],
  ])('rejects %j', (extra, message) => {
    expect(problem(extra)).toContain(`ethlete.apis.js: ${message}`);
  });
});
