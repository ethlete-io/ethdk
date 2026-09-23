import { defineCall } from '@design-explore';

export default defineCall({
  eyebrow: 'Design tool · call 2',
  headline: 'How does comparison start?',
  intro:
    'Comparison must be faster than manually inspecting two options. Each answer starts from the same three-option round and makes its activation cost visible.',
  frameWidth: 1100,
  rounds: [
    {
      key: 'r1',
      title: 'Comparison activation',
      note: 'A comparison starts with one click against the visible current winner. Hover is too easy to trigger and picking two options repeats the friction the tool is meant to remove.',
    },
  ],
  variants: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Hover to preview',
      claim:
        'Focus or hover any option and it immediately replaces the right side of a stable comparison against the current winner. Zero clicks.',
      cost: 'An accidental pointer pass changes the comparison, and touch needs a different gesture.',
      verdict: 'rejected',
      load: () => import('./variant-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · Click to compare with winner',
      claim: 'One click on an option opens it against the round winner; the baseline is implicit and always visible.',
      cost: 'Comparing two rejected alternatives takes an additional baseline change.',
      verdict: 'chosen',
      load: () => import('./variant-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · Pick two, then compare',
      claim: 'The reviewer explicitly chooses both sides before the comparison opens.',
      cost: 'It preserves the current multi-step friction and makes the common case too slow.',
      verdict: 'rejected',
      load: () => import('./variant-c'),
    },
  ],
});
