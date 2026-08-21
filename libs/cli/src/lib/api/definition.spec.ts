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
  it('leaves out setup when the API declares no setupCommand', () => {
    expect(apiCommandNames(definition())).toEqual(['up', 'down', 'logs', 'shell', 'clone', 'checkout', 'pull']);
  });

  it('lists setup when the API declares a setupCommand', () => {
    expect(apiCommandNames({ ...definition(), setupCommand: 'make setup' })).toEqual([
      'up',
      'down',
      'logs',
      'shell',
      'clone',
      'checkout',
      'pull',
      'setup',
    ]);
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
