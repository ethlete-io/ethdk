import { existsSync } from 'fs';
import { resolve } from 'path';
import { ACCEPT_USAGE, designAccept } from './system/accept-command';
import { checkDesign } from './check';
import { COMPLETE_USAGE, designComplete } from './system/complete-command';
import { findCheckoutRoot } from './paths';
import { designComment, designInbox } from './inbox-command';
import { markLegacy } from './legacy';
import { newCall } from './new-call';
import { designProduct } from './product-command';
import { serveDesign } from './serve';
import { ASSET_SHOT_USAGE, designAssetShot, designToken, TOKEN_USAGE } from './asset-shot';
import { designShot, SHOT_USAGE } from './shot-command';
import { designSketch, SKETCH_USAGE, sketchFlagHelpOf } from './sketch-command';
import { buildStampOf } from './stamp';
import { CALL_STATES, designStatus } from './status';
import { designPart, PART_USAGE } from './system/part-command';
import { designSystem } from './system/system-command';

/** Reads `--checkout <path>` out of an argument list, and answers with the path and the rest. */
const splitCheckout = (argv: string[], root: string) => {
  const index = argv.indexOf('--checkout');

  if (index === -1) return { target: findCheckoutRoot(root), rest: argv };

  return { target: resolve(root, argv[index + 1] ?? '.'), rest: [...argv.slice(0, index), ...argv.slice(index + 2)] };
};

const helpOf = (invocation: string) =>
  [
    `${invocation} [checkout] [--host <address>]`,
    '  Serve the variant frames of a checkout. The checkout defaults to the working directory. The server listens on',
    '  localhost; --host (or DE_HOST) names another address, e.g. 0.0.0.0 to reach it over the LAN.',
    '',
    `${invocation} check [--lint <file>…] [--tsconfig [path]] [--call <slug> [--variant <key>]]`,
    '  Find out why a call does not render: eslint, then tsc, then the live frames. --tsconfig also types each variant',
    '  of an open sketch.',
    '',
    `${invocation} check --product <name>`,
    "  Check a product's design system: layer dependencies, hard-coded colours, var() tokens nothing defines,",
    '  copied components, scripted motion, then tsc. Without any flag, check checks every product in config.json.',
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
    `${invocation} sketch new <layer>/<name> [<layer>/<name>…] --variants a,b --by <model id> [--like <layer>/<name>[:<variant>]] [--round <title>] [--note <text>] [--product <name>]`,
    '  Open a sketch on a part, new or existing, in progress. Each variant starts as a copy of the part, or of the part',
    "  --like names (a variant of its open sketch after the colon, with that sketch's shared/ folder).",
    '  Name several parts for one change across them: each variant holds every target, and ready, merge and the',
    '  commit take them together. Any other command finds the sketch by any of its targets.',
    "  Variants import code from the sketch's shared/ folder as @shared/<path>; a merge moves it into the target.",
    "  Any part imports the product's own shared/ folder as @shared/<path>; a sketch's file of the same path replaces it at merge.",
    '',
    `${invocation} sketch variant <layer>/<name> <variant> --from <variant> --by <model id> [--round <title> --note <why the running round lost>]`,
    '  Add a variant to the open sketch, as a copy of another, in the running round or a new one.',
    '',
    `${invocation} sketch report <layer>/<name> --variant <key> --by <model id> <text> [--product <name>] | sketch ready <layer>/<name> --by <model id>`,
    '  Tell Studio what you build on a variant now ("phone, outline state"), which also records you as one of its',
    '  authors, then mark the sketch ready for the user to pick.',
    '',
    `${invocation} sketch round <layer>/<name> <round> [--title <text>] [--note <text>] [--drops <state,state>] --by <model id> | sketch list [--json] | sketch check [<layer>/<name>] | sketch preview <layer>/<name> <variant> [--json]`,
    '  List open sketches, check each variant laid over the product, and list the elements and pages a merge changes.',
    '',
    `${invocation} sketch merge <layer>/<name> [--note <reason>] --by <model id> | sketch discard <layer>/<name> --by <model id>`,
    '  Merge the variant the user picked, set the note and madeBy (its authors) on the target, then check and',
    '  restore the old files on failure. Or drop the sketch. Both resolve the addressed comments on its variants and mark the open ones addressed. Studio runs',
    "  both on the user's click, so an agent runs neither after a pick. Merge refuses without a pick,",
    '  and when a part the variant replaces changed in the product since the sketch was created.',
    '',
    `${invocation} sketch rebase <layer>/<name> --by <model id>`,
    '  After bringing each variant up to date with the product, record the product as it is now for the merge.',
    '',
    `${invocation} ${ACCEPT_USAGE}`,
    "  Record a direct edit of a merged part that the user approved without a sketch: writes the part's hash to",
    '  merged.json, so check stops warning of it, and logs who accepted it and why in accepted.json. Refuses an unknown',
    '  part, a part with an open sketch, and a part with no change outside a sketch.',
    '',
    `${invocation} ${COMPLETE_USAGE}`,
    '  Exit 1 while a control the part declares in definePart({ controls }) lacks a drawn state or surface: hover and',
    '  active for pointer input, focus-visible for keyboard, and for a disclosure a collapsed state and its visible',
    '  body. A part that changed since its last merge or accept fails too, and so does a drawn control without a',
    '  data-et-control marker, or an element with a pointer cursor or :hover rule but no control role. A control',
    '  inside an embedded part (its data-et-part root) belongs to that part, which must be complete itself; a rule',
    "  of the part's own CSS that restyles it fails as CONTROL-OVERRIDDEN. Separate from check and sketch ready:",
    '  a round can be ready for comparison and still not complete for implementation.',
    '',
    `${invocation} ${PART_USAGE}`,
    "  Delete a part's folder and its merged.json entry, rewrite the product tsconfig paths, and resolve its comments.",
    '  Refuses a base part, a part another part imports, and a part with an open sketch.',
    '',
    `${invocation} ${SHOT_USAGE}`,
    '  Draw every state of a part, and with --variants every variant of its open sketch, into one contact sheet',
    '  PNG with a label per cell, and print its path. Without --state, --variants alone draws the first state.',
    '  With --variants --at <commit>, the sketch is read from that commit instead, so a merged sketch (its folder',
    '  is deleted at merge) draws again against the part as it is now; pick the last commit that still held it.',
    '  Without --preset or --width, a page draws at its first product preset and any other part fitted.',
    '  With --variants --crop changed, every cell is cut to one box around the pixels any shown variant changes',
    '  from the merged part, plus a margin, and the box is printed for a later --crop x,y,width,height.',
    '',
    `${invocation} ${ASSET_SHOT_USAGE}`,
    '  Draw an image file (svg, png, webp, ...) of a path, or of a product assets/ folder with --product, into a PNG',
    '  and print its path. --width sets the drawn width in px.',
    '',
    `${invocation} ${TOKEN_USAGE}`,
    '  Print the colour a custom property of the product tokens resolves to, as hex; oklch and color-mix resolve in',
    '  Chromium. The product defaults to the only one of config.json.',
    '',
    `${invocation} inbox [--json] | inbox done <id> --note <text> --by <model id>`,
    '  List open comment threads where the user has the last word and the sketches that need a rebase, oldest first,',
    '  then the threads and the pick and discard decisions waiting for the user. done sets the note of the part the',
    '  thread is about, then marks it addressed. Only the user resolves a thread, in Studio.',
    '',
    `${invocation} comment <layer>/<name> <state> --preset <preset> <text> [--at x,y] [--sketch <layer>/<name> --variant <key>]`,
    '  Write a comment on a state of a part, as Studio does from the canvas.',
    '',
    `${invocation} comment reply <id> --by <model id> <text> [--question]`,
    '  Answer a comment thread as the agent. It then waits for the user until the user replies. --question marks a',
    "  reply that needs the user's answer; any other reply leaves the thread answered.",
    '',
    `${invocation} comment resolve-ended`,
    '  Resolve every addressed comment whose sketch is merged, discarded or replaced. Open comments stay open.',
    '',
    '  sketch and comment take --product <name>; it may be left out when config.json declares one product.',
    '  inbox without --product covers every product.',
    '  --by is the exact model id of the agent that writes, e.g. claude-opus-5-5; every agent write needs it.',
    '',
    `${invocation} stamp`,
    '  Print the version and build of this cli as JSON, which a running server answers with too.',
    '',
    'Every command takes --checkout <path>. DE_PORT overrules the port in .ethlete/design/config.json.',
    '',
  ].join('\n');

const HELP_FLAGS = new Set(['--help', '-h']);

const alternativesOf = (block: string[], invocation: string) =>
  (block[0] ?? '').split(' | ').map((usage) => usage.replace(`${invocation} `, ''));

const matchingBlocksOf = (invocation: string, words: string[]) => {
  const blocks = helpOf(invocation)
    .split('\n\n')
    .map((block) => block.split('\n'));
  const command = words.join(' ');

  return blocks.filter((block) =>
    alternativesOf(block, invocation).some((usage) => usage === command || usage.startsWith(`${command} `)),
  );
};

/** The usage of the one subcommand `argv` names, for `et design <command> [<subcommand>] … --help`. */
const subcommandHelpOf = (invocation: string, argv: string[]) => {
  const [command = '', subcommand = ''] = argv;

  if (command === 'sketch') {
    const lines = SKETCH_USAGE.filter((line) => line.startsWith(`sketch ${subcommand} `));

    return lines.length > 0
      ? lines.flatMap((line) => [`usage: ${invocation} ${line}`, ...sketchFlagHelpOf(line)]).join('\n')
      : SKETCH_USAGE.map((line) => `usage: ${invocation} ${line}`).join('\n');
  }

  const precise = subcommand.startsWith('-') ? [] : matchingBlocksOf(invocation, [command, subcommand]);
  const blocks = precise.length > 0 ? precise : matchingBlocksOf(invocation, [command]);

  return blocks.length > 0 ? blocks.map((block) => block.join('\n')).join('\n\n') : helpOf(invocation);
};

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

  if (argv.slice(1).some((arg) => HELP_FLAGS.has(arg))) {
    console.log(subcommandHelpOf(invocation, argv));

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

  if (argv[0] === 'accept') {
    const { target, rest } = splitCheckout(argv.slice(1), root);

    return designAccept({ target, argv: rest, invocation });
  }

  if (argv[0] === 'complete') {
    const { target, rest } = splitCheckout(argv.slice(1), root);

    return designComplete({ target, argv: rest, invocation });
  }

  if (argv[0] === 'part') {
    const { target, rest } = splitCheckout(argv.slice(1), root);

    return designPart({ target, argv: rest, invocation });
  }

  if (argv[0] === 'shot') {
    const { target, rest } = splitCheckout(argv.slice(1), root);

    return rest.includes('--asset')
      ? designAssetShot({ target, argv: rest, invocation })
      : designShot({ target, argv: rest, invocation });
  }

  if (argv[0] === 'token') {
    const { target, rest } = splitCheckout(argv.slice(1), root);

    return designToken({ target, argv: rest, invocation });
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

  const { target, rest: afterCheckout } = splitCheckout(argv, root);
  const hostIndex = afterCheckout.indexOf('--host');
  const host = hostIndex === -1 ? undefined : afterCheckout[hostIndex + 1];
  const rest =
    hostIndex === -1 ? afterCheckout : [...afterCheckout.slice(0, hostIndex), ...afterCheckout.slice(hostIndex + 2)];
  const positional = rest[0];

  if (positional && !existsSync(resolve(root, positional))) {
    console.error(`unknown command or checkout "${positional}"`);
    console.error(helpOf(invocation));

    return 2;
  }

  return serveDesign({ target: positional ? resolve(root, positional) : target, host });
};
