import { describe, expect, it } from 'vitest';
import { ApiDefinition, apiCommandNames, dependencyInstallCommandName, installsDependencies } from './definition';

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

describe('installsDependencies', () => {
  it('recognises a package manager', () => {
    expect(installsDependencies(['composer', 'install'])).toBe(true);
    expect(installsDependencies(['yarn'])).toBe(true);
  });

  it('does not recognise a make target', () => {
    expect(installsDependencies(['make', 'reset-db-with-dev-fixtures'])).toBe(false);
    expect(installsDependencies([])).toBe(false);
  });
});

describe('dependencyInstallCommandName', () => {
  it('names the exec entry that installs dependencies', () => {
    const api = definition({ 'reset-db': ['make', 'reset-db'], install: ['composer', 'install'] });

    expect(dependencyInstallCommandName(api)).toBe('install');
  });

  it('is undefined when no entry installs anything', () => {
    expect(dependencyInstallCommandName(definition({ 'reset-db': ['make', 'reset-db'] }))).toBeUndefined();
    expect(dependencyInstallCommandName(definition())).toBeUndefined();
  });
});
