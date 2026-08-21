import { apiCommand, authCommand, doctorCommand, release, repoInvocation, updateCommand } from './lib';

const USAGE_ROWS = [
  { subcommand: 'release', args: '', lines: ['Turn pending changesets into a tagged, pushed release commit'] },
  {
    subcommand: 'api',
    args: ' <cmd> <api>',
    lines: [
      "Run an API from this repo's ethlete.apis.js locally",
      "(up, down, logs, shell, setup, plus that API's own exec entries)",
    ],
  },
  {
    subcommand: 'auth',
    args: ' [host] <token>',
    lines: [
      "Write a GitLab token into composer's auth.json, which the",
      'API containers mount, after checking it can download code',
    ],
  },
  {
    subcommand: 'doctor',
    args: '',
    lines: ["Check this machine's ethlete.config.local.json, container engine", 'and every API checkout'],
  },
  {
    subcommand: 'update',
    args: ' [packages...]',
    lines: ['Move the @ethlete/* packages to a newer version and run the', 'migrations those versions ship'],
  },
];

const usage = (root: string) => {
  const rows = USAGE_ROWS.map((row) => ({
    ...row,
    command: `${repoInvocation({ root, subcommand: row.subcommand })}${row.args}`,
  }));
  const width = Math.max(...rows.map((row) => row.command.length));

  return [
    'et — Ethlete repo tooling',
    '',
    ...rows.flatMap((row) =>
      row.lines.map((line, index) => `  ${(index === 0 ? row.command : '').padEnd(width)}  ${line}`),
    ),
    '',
  ].join('\n');
};

const cli = async (args: string[]): Promise<number> => {
  switch (args[0]) {
    case 'release':
      // `release` reads its flags from a list that was split on "=" before this switch existed.
      // Keep that shape here so its own parsing is untouched.
      await release(args.join('=').split('='));

      return 0;

    case 'api':
      return apiCommand({
        root: process.cwd(),
        argv: args.slice(1),
        invocation: repoInvocation({ root: process.cwd(), subcommand: 'api' }),
      });

    case 'auth':
      return authCommand({
        root: process.cwd(),
        argv: args.slice(1),
        invocation: repoInvocation({ root: process.cwd(), subcommand: 'auth' }),
      });

    case 'update':
      return updateCommand({
        root: process.cwd(),
        argv: args.slice(1),
        invocation: repoInvocation({ root: process.cwd(), subcommand: 'update' }),
      });

    case 'doctor':
      // Every fix it names is an `et api` command, so it needs that script rather than its own.
      return doctorCommand({
        root: process.cwd(),
        apiInvocation: repoInvocation({ root: process.cwd(), subcommand: 'api' }),
      });

    default:
      console.log(usage(process.cwd()));

      return args[0] === undefined || args[0] === '--help' || args[0] === '-h' ? 0 : 1;
  }
};

export * from './lib';

// Guarded so the package can also be imported as a library without running the CLI.
if (require.main === module) {
  cli(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
