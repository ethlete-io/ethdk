import { apiCommand, doctorCommand, release } from './lib';

const USAGE = `et — Ethlete repo tooling

  et release            Turn pending changesets into a tagged, pushed release commit
  et api <cmd> <api>    Run an API from this repo's ethlete.apis.js locally
                        (up, down, logs, shell, plus that API's own exec entries)
  et doctor             Check this machine's ethlete.config.local.json, container engine
                        and every API checkout
`;

const cli = async (args: string[]): Promise<number> => {
  switch (args[0]) {
    case 'release':
      // `release` reads its flags from a list that was split on "=" before this switch existed.
      // Keep that shape here so its own parsing is untouched.
      await release(args.join('=').split('='));

      return 0;

    case 'api':
      return apiCommand({ root: process.cwd(), argv: args.slice(1) });

    case 'doctor':
      return doctorCommand({ root: process.cwd() });

    default:
      console.log(USAGE);

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
