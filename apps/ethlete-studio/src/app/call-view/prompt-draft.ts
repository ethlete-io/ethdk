import { AddedOptions, Call, CallOption } from '../../host/design';

/** The file a full session writes its state into, next to the call it worked on. */
export const HANDOFF_FILE = 'handoff.md';

/** What the user wants to happen next to one option. A verb never runs the agent on its own. */
export type Verb = 'accept' | 'iterate' | 'reject' | 'more';

/** The verdict a verb writes back to the call file. A verb without one leaves the option as it is. */
export const verdictOf = (verb: Verb) => {
  if (verb === 'accept') return 'chosen' as const;
  if (verb === 'reject') return 'rejected' as const;

  return null;
};

export const verbLabel: Record<Verb, string> = {
  accept: 'Accept',
  iterate: 'Iterate',
  reject: 'Reject',
  more: 'More like this',
};

/** Which option of which call the draft is about, and where the call file is. */
export type DraftSubject = {
  call: Call;
  option: CallOption;
  dir: string;
  /** What Studio created for the round this verb opened. Left out by a verb that opens none. */
  made?: AddedOptions | null;
};

const task: Record<Verb, string> = {
  accept:
    'Carry this option into the app. Keep what the claim promises, and say in your answer what you did about the cost.',
  iterate: 'Draw a new round that keeps the claim and answers the cost.',
  reject:
    'This direction is closed. Draw a new round that answers the same question another way, and say in each claim how it avoids the cost above.',
  more: 'Draw a new round of variants in this direction. Each one changes one thing, and its claim names the thing it changes.',
};

/**
 * What every prompt carries, whatever the verb: the tool set Studio runs, and the rules that do not
 * bend. A rule the agent has to fetch is a rule it can skip, so both stay in the prompt itself.
 */
const groundRules = [
  '',
  'Studio runs three tools for you. Each one takes no argument and already knows this call:',
  '- read_call: the question, the intro and every variant drawn so far.',
  '- read_fixture: the data every variant of this call draws.',
  '- check_call: lints the variant under study, type-checks the call, and renders it.',
  '',
  'These rules do not bend:',
  '- Never import a package barrel. A frame that does dies with ERR_INSUFFICIENT_RESOURCES.',
  '  Import the file the symbol lives in.',
  '- Never change the fixture. Every variant draws the same data, or the comparison says nothing.',
  '- Write one component file per variant, and in the call file only the name, the claim and the',
  '  cost. Change nothing else in the checkout.',
  '- Run check_call after every edit. Never say you are done before it answers ok.',
];

/** True when Studio opens the round itself, so the verb needs the files it made. */
export const opensARound = (verb: Verb) => verb !== 'accept';

/** What Studio already wrote for a new round, so the run spends its budget on the drawing alone. */
const boilerplate = (dir: string, made: AddedOptions) => [
  '',
  `Studio already opened round ${made.round} and created one empty component per option:`,
  ...made.keys.map((key) => `- ${dir}/option-${key}.ts`),
  'Draw into those files. Each one holds a component with an empty template and empty styles.',
  'Add no option to the call file: the entries are there. Write only the name, the claim and the',
  'cost of each new option into it, and the note of the round once the user has ruled.',
];

/** The first draft of the prompt a verb sends. The user reads and edits it before it goes out. */
export const promptDraft = ({ call, option, dir, made }: DraftSubject, verb: Verb) =>
  [
    `${verbLabel[verb]}: option "${option.name}" of the call "${call.headline}".`,
    '',
    `The call file: ${dir}/call.ts`,
    `The claim: ${option.claim || '(none written)'}`,
    `The cost: ${option.cost || '(none written)'}`,
    '',
    ...(call.handoff
      ? [`Read ${dir}/${HANDOFF_FILE}: an earlier session of this call wrote down what it knew.`]
      : []),
    task[verb],
    ...(made ? boilerplate(dir, made) : []),
    ...groundRules,
  ].join('\n');

/**
 * The prompt that empties a full session. It asks for the state in a file, so the next session reads
 * a page instead of paying for the whole conversation again.
 */
export const handoffDraft = ({ call, dir }: Pick<DraftSubject, 'call' | 'dir'>) =>
  [
    `Hand off: the call "${call.headline}".`,
    '',
    `This conversation is full, and a fresh one takes over. Write what that one needs into`,
    `${dir}/${HANDOFF_FILE}, then stop. Change nothing else.`,
    '',
    'Write for a reader who sees none of this conversation:',
    '- What this call asks, and where the work stands.',
    '- Every decision and constraint the user stated, in the words they used.',
    '- What you tried that did not work, and why it did not.',
    '- What the next step is, named by file and by command.',
    '',
    'Name a file by its path. Do not retell the conversation, and do not repeat the call file.',
  ].join('\n');
