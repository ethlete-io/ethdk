import { API_DEFINITIONS_FILE_NAMES, loadApiDefinitions } from './load-definitions';
import { runApiCommand } from './run';

export const apiCommand = ({ root, argv }: { root: string; argv: string[] }) => {
  const { found, apis } = loadApiDefinitions(root);

  if (!found) {
    console.error(
      `No API definitions found. Create ${API_DEFINITIONS_FILE_NAMES[0]} in the repo root:\n\n` +
        `  const { sshKeyPath } = require('@ethlete/cli');\n\n` +
        `  module.exports = {\n` +
        `    hub: {\n` +
        `      composeDir: 'development',\n` +
        `      services: ['app', 'database'],\n` +
        `      execService: 'app',\n` +
        `      port: 8040,\n` +
        `      envFile: '.env',\n` +
        `      setupCommand: 'make setup',\n` +
        `      exec: { install: ['composer', 'install'] },\n` +
        `    },\n` +
        `  };`,
    );

    return 1;
  }

  return runApiCommand({ apis, argv, root });
};
