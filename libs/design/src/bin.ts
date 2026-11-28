#!/usr/bin/env node
import { repoInvocation } from '@ethlete/cli-core/invocation';
import { designCommand } from './lib/design/design-command';

/** Runs `<entry> design …` the way `et design …` runs it, so Studio and the `et design` forwarder call both alike. */
export const runDesignEntry = (args: string[], root = process.cwd()): Promise<number> => {
  if (args[0] !== 'design') {
    console.error('usage: <entry> design [checkout] | design <subcommand> …');

    return Promise.resolve(1);
  }

  return designCommand({
    root,
    argv: args.slice(1),
    invocation: repoInvocation({ root, subcommand: 'design' }),
  });
};

if (require.main === module) {
  runDesignEntry(process.argv.slice(2))
    .then((code) => {
      process.exitCode = Math.max(code, Number(process.exitCode ?? 0) || 0);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
