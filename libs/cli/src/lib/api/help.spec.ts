import { describe, expect, it } from 'vitest';
import { ApiDefinition } from './definition';
import { apiHelp } from './help';

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

    expect(help).toContain('hub       up, down, logs, shell, checkout, pull, install');
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
});
