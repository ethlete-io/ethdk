import { AddedVariants, Call, CallMode, CallVariant } from '../../host/design';

/** The file a full session writes its state into, next to the call it worked on. */
export const HANDOFF_FILE = 'handoff.md';

/** What the user wants to happen next to one variant. A verb never runs the agent on its own. */
export type Verb = 'accept' | 'iterate' | 'reject' | 'more';

/** The verdict a verb writes back to the call file. A verb without one leaves the variant as it is. */
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

/** Which variant of which call the draft is about, and where the call file is. */
export type DraftSubject = {
  call: Call;
  variant: CallVariant;
  dir: string;
  /** What Studio created for the round this verb opened. Left out by a verb that opens none. */
  made?: AddedVariants | null;
  /** What the user wrote on the compose card, under the verb and the variant it names. */
  message?: string;
};

/**
 * What a verb press fixed. The variant it names is stated on the compose card, so a draft left
 * waiting keeps its subject even when the reader opens another variant.
 */
export type Compose = Omit<DraftSubject, 'made' | 'message'> & { verb: Verb; round: string };

const task: Record<Verb, string> = {
  accept:
    'Carry this variant into the app. Keep what the claim promises, and say in your answer what you did about the cost.',
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

/**
 * What the call's mode asks of the drawing. A wireframe answers whether the workflow is right, so
 * anything that argues about the finish costs the round its answer.
 */
const modeRules: Record<CallMode, string[]> = {
  wireframe: [
    '',
    'This call is in wireframe mode. Draw the bare workflow and nothing more:',
    '- Mock every value. Wire up no logic, no state and no data source.',
    '- Draw no hover, focus, pressed or disabled state.',
    '- Spend nothing on colour, type or finish beyond what the structure needs to read.',
  ],
  design: [
    '',
    'This call is in design mode. Draw the real thing: the colour, the type, the spacing and every',
    'interaction state the drawing needs.',
  ],
};

/** True when Studio opens the round itself, so the verb needs the files it made. */
export const opensARound = (verb: Verb) => verb !== 'accept';

/** What Studio already wrote for a new round, so the run spends its budget on the drawing alone. */
const boilerplate = (dir: string, made: AddedVariants) => [
  '',
  `Studio already opened round ${made.round} and created one empty component per variant:`,
  ...made.keys.map((key) => `- ${dir}/variant-${key}.ts`),
  'Draw into those files. Each one holds a component with an empty template and empty styles.',
  'Add no variant to the call file: the entries are there. Write only the name, the claim and the',
  'cost of each new variant into it, and the note of the round once the user has ruled.',
];

/** The prompt a verb sends. The verb and the variant it names are fixed at the press. */
export const promptDraft = ({ call, variant, dir, made, message }: DraftSubject, verb: Verb) =>
  [
    `${verbLabel[verb]}: variant "${variant.name}" of the call "${call.headline}".`,
    '',
    `The call file: ${dir}/call.ts`,
    `The claim: ${variant.claim || '(none written)'}`,
    `The cost: ${variant.cost || '(none written)'}`,
    '',
    ...(call.handoff ? [`Read ${dir}/${HANDOFF_FILE}: an earlier session of this call wrote down what it knew.`] : []),
    task[verb],
    ...(message ? ['', message] : []),
    ...(made ? boilerplate(dir, made) : []),
    ...modeRules[call.mode],
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
