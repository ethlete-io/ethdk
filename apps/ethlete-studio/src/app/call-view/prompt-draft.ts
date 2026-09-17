import { Call, CallOption } from '../../host/design';

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
};

const task: Record<Verb, string> = {
  accept:
    'Carry this option into the app. Keep what the claim promises, and say in your answer what you did about the cost.',
  iterate:
    'Draw a new round that keeps the claim and answers the cost. Give each new option its own folder, its own claim and its own cost, and add it to the call file.',
  reject:
    'This direction is closed. Draw a new round that answers the same question another way, and say in each claim how it avoids the cost above.',
  more: 'Draw a new round of variants in this direction. Each one changes one thing, and its claim names the thing it changes.',
};

/** The first draft of the prompt a verb sends. The user reads and edits it before it goes out. */
export const promptDraft = ({ call, option, dir }: DraftSubject, verb: Verb) =>
  [
    `${verbLabel[verb]}: option "${option.name}" of the call "${call.headline}".`,
    '',
    `The call file: ${dir}/call.ts`,
    `The claim: ${option.claim || '(none written)'}`,
    `The cost: ${option.cost || '(none written)'}`,
    '',
    'Read the call file first. It carries the question, the intro and every option drawn so far.',
    task[verb],
  ].join('\n');
