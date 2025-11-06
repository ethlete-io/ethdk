import { release } from './lib';

const cli = async (args: string[]) => {
  const cliFunctionArg = args[0];

  switch (cliFunctionArg) {
    case 'release':
      await release(args);
      break;

    default:
      console.log(`No command found named ${cliFunctionArg}. Available commands are: release`);
      break;
  }
};

// Get the command line arguments and normalize them
const args = process.argv.slice(2).join('=').split('=');

cli(args);

// Burst cache
