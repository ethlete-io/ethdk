import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { STUDIO_API_LEVEL } from './server-identity';
import snapshot from './studio-api-level.snapshot.json';

const routesOf = () => {
  const routes = new Set<string>();

  for (const file of readdirSync(__dirname, { recursive: true }) as string[]) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) continue;

    for (const [, route] of readFileSync(join(__dirname, file), 'utf8').matchAll(/'(\/__design\/[^'\s]*)'/g)) {
      routes.add(route as string);
    }
  }

  return [...routes].sort();
};

describe('STUDIO_API_LEVEL', () => {
  it('moves with the Studio-server routes', () => {
    const current = { apiLevel: STUDIO_API_LEVEL, routes: routesOf() };

    expect(current, 'a Studio-server route changed - bump STUDIO_API_LEVEL and update the snapshot').toEqual(snapshot);
  });
});
