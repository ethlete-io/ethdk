import { describe, expect, it } from 'vitest';
import { ApiDefinition } from './definition';
import { apiHelp, singleApiHelp } from './help';

const definition = (exec?: Record<string, string[]>): ApiDefinition => ({
  composeDir: 'development',
  services: ['app'],
  execService: 'app',
  port: 8040,
  exec,
});

describe('apiHelp', () => {
  it('lists the built-in commands', () => {
    const help = apiHelp({ hub: definition() }, 'et api');

    expect(help).toContain('Usage: et api <command> <api> [--host]');
    expect(help).toContain('up        Start the containers of the API');
    expect(help).toContain('shell     Open a shell in the API container');
  });

  it('lists each API with the commands it accepts', () => {
    const help = apiHelp({ hub: definition({ install: ['composer', 'install'] }) }, 'et api');

    expect(help).toContain('hub       up, down, logs, shell, clone, clear, checkout, pull, install');
  });

  it('lists an exec entry once even when several APIs declare it', () => {
    const help = apiHelp({ hub: definition({ install: ['a'] }), shop: definition({ install: ['b'] }) }, 'et api');

    expect(help.match(/^ {2}install/gm)).toHaveLength(1);
  });

  it('says where to declare an API when none exist', () => {
    expect(apiHelp({}, 'et api')).toContain('declare them in ethlete.apis.js');
  });

  it('uses the invocation it was given', () => {
    expect(apiHelp({}, 'yarn api')).toContain('Usage: yarn api <command> <api>');
  });

  it('names the help command itself', () => {
    expect(apiHelp({ hub: definition() }, 'yarn api')).toContain('help');
  });
});

describe('singleApiHelp', () => {
  const api = {
    ...definition({ install: ['composer', 'install'] }),
    envFile: '.env',
    setupCommand: 'make setup',
    envKey: 'hubApiEnv',
  };

  it('names the API in the usage line', () => {
    expect(singleApiHelp({ name: 'hub', api, invocation: 'yarn api' })).toContain('Usage: yarn api <command> hub');
  });

  it('says what an exec entry runs', () => {
    expect(singleApiHelp({ name: 'hub', api, invocation: 'yarn api' })).toContain('install   composer install');
  });

  it('says what setup runs, and where', () => {
    expect(singleApiHelp({ name: 'hub', api, invocation: 'yarn api' })).toContain('Run "make setup" in development');
  });

  it('lists the url, the services and the env file', () => {
    const help = singleApiHelp({ name: 'hub', api, invocation: 'yarn api' });

    expect(help).toContain('http://localhost:8040');
    expect(help).toContain('services  app');
    expect(help).toContain('development/.env');
  });

  it('leaves out setup for an API that declares no setupCommand', () => {
    expect(singleApiHelp({ name: 'hub', api: definition(), invocation: 'yarn api' })).not.toContain('setup');
  });

  it('shows the state of the checkout when it is given one', () => {
    expect(singleApiHelp({ name: 'hub', api, invocation: 'yarn api', checkout: 'Missing .env in /repo.' })).toContain(
      'Missing .env in /repo.',
    );
  });
});
