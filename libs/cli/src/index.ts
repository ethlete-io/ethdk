import { dsp } from './lib';

const cli = async (args: string[]) => {
  const cliFunctionArg = args[0];

  switch (cliFunctionArg) {
    case 'dsp':
      await dsp(args);
      break;

    default:
      console.log(`No command found named ${cliFunctionArg}. Available commands are: dsp`);
      break;
  }
};

// Get the command line arguments and normalize them
const args = process.argv.slice(2).join('=').split('=');

cli(args);
