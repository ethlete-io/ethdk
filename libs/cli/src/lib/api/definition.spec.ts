import { describe, expect, it } from 'vitest';
import { ApiDefinition, apiCommandNames } from './definition';

const definition = (exec?: Record<string, string[]>): ApiDefinition => ({
  composeDir: 'development',
  services: ['app'],
  execService: 'app',
  port: 8040,
  exec,
});

describe('apiCommandNames', () => {
  it('lists the built-in commands when the API has no exec entries', () => {
    expect(apiCommandNames(definition())).toEqual(['up', 'down', 'logs', 'shell', 'clone', 'checkout', 'pull']);
  });

  it('appends the API’s own exec entries', () => {
    expect(apiCommandNames(definition({ install: ['composer', 'install'] }))).toEqual([
      'up',
      'down',
      'logs',
      'shell',
      'clone',
      'checkout',
      'pull',
      'install',
    ]);
  });
});
