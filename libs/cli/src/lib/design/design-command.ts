import { resolve } from 'path';
import { checkDesign } from './check';
import { designComment, designInbox } from './inbox-command';
import { markLegacy } from './legacy';
import { newCall } from './new-call';
import { designProduct } from './product-command';
import { serveDesign } from './serve';
import { designSketch } from './sketch-command';
import { buildStampOf } from './stamp';
import { CALL_STATES, designStatus } from './status';
import { designSystem } from './system/system-command';

/** Reads `--checkout <path>` out of an argument list, and answers with the path and the rest. */
const splitCheckout = (argv: string[], root: string) => {
  const index = argv.indexOf('--checkout');

  if (index === -1) return { target: root, rest: argv };

  return { target: resolve(root, argv[index + 1] ?? '.'), rest: [...argv.slice(0, index), ...argv.slice(index + 2)] };
};

const helpOf = (invocation: string) =>
  [
    `${invocation} [checkout]`,
    '  Serve the variant frames of a checkout. The checkout defaults to the working directory.',
    '',
    `${invocation} check [--lint <file>…] [--tsconfig [path]] [--call <slug> [--variant <key>]]`,
    '  Find out why a call does not render: eslint, then tsc, then the live frames.',
    '',
    `${invocation} check --product <name>`,
    "  Check a product's design system: layer dependencies, hard-coded colours, copied components,",
    '  scripted motion, then tsc. Without any flag, check checks every product in config.json.',
    '',
    `${invocation} system --json [--product <name>]`,
    "  Print each product's parts as JSON: origin, note, states, widths, presets and the problems of each part.",
    '',
    `${invocation} product new <name> [--base <path|@ethlete/components>] [--from-project <name>]`,
    '  Create a product: its config.json entry and the empty layer folders. Without a base it gets the presets',
    '  phone (390x844) and desktop (1440x900). --from-project copies styles, head, providers and themes.',
    '',
    `${invocation} new <project>/<group>/<name> --stage <stage> [--variants a,b] [--feature <name>]`,
    '  Write a call that renders at once: call.ts, fixture.ts and one variant file per key.',
    '  A quick exploration of an idea takes --stage sketch.',
    '  --feature <name> groups the call under a feature in Ethlete Studio; without one it shows under "No feature".',
    '',
    `${invocation} legacy <project>`,
    '  Mark every call of a project without a stage as legacy, so check accepts it.',
    '  The stage comes from the group folder: foundations, components, pages. Rerun it to add one to an old legacy call.',
    '',
    `${invocation} status <slug> <${CALL_STATES.join('|')}>`,
    '  Record the state of a call for Ethlete Studio. new and check --call record theirs on their own.',
    '',
    `${invocation} sketch new <layer>/<name> --variants a,b [--product <name>]`,
    '  Open a sketch on a part, new or existing, in progress. Each variant starts as a copy of the part.',
    '',
    `${invocation} sketch report <layer>/<name> <text> | sketch ready <layer>/<name>`,
    '  Tell Studio what you build now ("variant b, phone"), then mark the sketch ready for the user to pick.',
    '',
    `${invocation} sketch list [--json] | sketch check [<layer>/<name>] | sketch preview <layer>/<name> <variant> [--json]`,
    '  List open sketches, check each variant laid over the product, and list the elements and pages a merge changes.',
    '',
    `${invocation} sketch merge <layer>/<name> --note <reason> | sketch discard <layer>/<name>`,
    '  Merge the variant the user picked and set the note on the target, then check and restore the old files on',
    '  failure. Or drop the sketch. Both refuse while the sketch has open comments. Merge refuses without a pick,',
    '  and when a part the variant replaces changed in the product since the sketch was created.',
    '',
    `${invocation} sketch rebase <layer>/<name>`,
    '  After bringing each variant up to date with the product, record the product as it is now for the merge.',
    '',
    `${invocation} inbox [--json] | inbox done <id> --note <text>`,
    "  List comment threads where the user has the last word and the user's pick and discard decisions, oldest",
    '  first, then the threads waiting for the user. done sets the note of the part the thread is about, then deletes it.',
    '',
    `${invocation} comment <layer>/<name> <state> --preset <preset> <text> [--at x,y] [--sketch <layer>/<name> --variant <key>]`,
    '  Write a comment on a state of a part, as Studio does from the canvas.',
    '',
    `${invocation} comment reply <id> <text>`,
    '  Answer a comment thread as the agent. It then waits for the user until the user replies.',
    '',
    '  sketch and comment take --product <name>; it may be left out when config.json declares one product.',
    '  inbox without --product covers every product.',
    '',
    `${invocation} stamp`,
    '  Print the version and build of this cli as JSON, which a running server answers with too.',
    '',
    'Every command takes --checkout <path>. DE_PORT overrules the port in .ethlete/design/config.json.',
    '',
  ].join('\n');

/**
 * `et design [checkout]` serves the variant frames of a checkout, and `et design check …` says why
 * a call does not render. Both work on any checkout that keeps a `.ethlete/design` folder, so a
 * repository needs no design tooling of its own.
 */
export const designCommand = async (options: { root: string; argv: string[]; invocation: string }): Promise<number> => {
  const { root, argv, invocation } = options;

  if (argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    console.log(helpOf(invocation));

    return 0;
  }

  if (argv[0] === 'stamp') {
    console.log(JSON.stringify(buildStampOf()));

    return 0;
  }

  if (argv[0] === 'check') {
    const { target, rest } = splitCheckout(argv.slice(1), root);

    return checkDesign({ target, argv: rest, invocation });
  }

  if (argv[0] === 'system') {
    const { target, rest } = splitCheckout(argv.slice(1), root);

    return designSystem({ target, argv: rest, invocation });
  }

  if (argv[0] === 'new') {
    const { target, rest } = splitCheckout(argv.slice(1), root);

    return newCall({ target, argv: rest, invocation });
  }

  if (argv[0] === 'product') {
    const { target, rest } = splitCheckout(argv.slice(1), root);

    return designProduct({ target, argv: rest, invocation });
  }

  if (argv[0] === 'legacy') {
    const { target, rest } = splitCheckout(argv.slice(1), root);

    return markLegacy({ target, argv: rest, invocation });
  }

  if (argv[0] === 'sketch') {
    const { target, rest } = splitCheckout(argv.slice(1), root);

    return designSketch({ target, argv: rest, invocation });
  }

  if (argv[0] === 'inbox') {
    const { target, rest } = splitCheckout(argv.slice(1), root);

    return designInbox({ target, argv: rest, invocation });
  }

  if (argv[0] === 'comment') {
    const { target, rest } = splitCheckout(argv.slice(1), root);

    return designComment({ target, argv: rest, invocation });
  }

  if (argv[0] === 'status') {
    const { target, rest } = splitCheckout(argv.slice(1), root);

    return designStatus({ target, argv: rest, invocation });
  }

  const { target, rest } = splitCheckout(argv, root);
  const positional = rest[0];

  return serveDesign({ target: positional ? resolve(root, positional) : target });
};
