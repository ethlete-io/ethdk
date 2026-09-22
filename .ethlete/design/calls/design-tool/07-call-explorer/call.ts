import { defineCall } from '@design-explore';

export default defineCall({
  feature: 'the call explorer',
  eyebrow: 'Design tool · call 7',
  headline: 'How does the explorer stay readable once a project holds two dozen calls?',
  intro:
    'Call 6 settled the shell: the explorer runs the full height of the window, it heads with the project name and the Projects control, and the status bar at the foot took the rest of the chrome. This call draws that sidebar alone at 420px. Today it stacks every call under its feature, so the one call a reader is on sits somewhere in a list that only grows. Each option orders the same eleven calls a different way. All three draw the @ethlete surface and colour tokens.',
  frameWidth: 420,
  rounds: [
    {
      key: 'r1',
      title: 'What orders the list',
      note: 'B wins. The list a reader works in is the open one, and leading with it keeps that list short however long the project gets. A lost because a feature group with an open call never collapses, so the list still only grows. C lost because a list that reorders itself while you work is a list you cannot learn, and nothing in it says how a feature is doing.',
    },
  ],
  options: [
    {
      key: 'a',
      round: 'r1',
      name: 'A · Features, with the counts up front',
      claim:
        'The feature stays the only grouping, but each group head carries how many of its calls are still open, and a group with nothing open collapses to that one line.',
      cost: 'The call a reader wants can still be the last row of the last group, and a fresh project has no collapsed groups at all.',
      verdict: 'rejected',
      load: () => import('./option-a'),
    },
    {
      key: 'b',
      round: 'r1',
      name: 'B · Open first, settled folded away',
      claim:
        'One Open section leads the sidebar with every unsettled call across all features, each tagged with its feature. The settled calls fold into their feature groups below it.',
      cost: 'A call appears under two headings over its life, so a reader who learnt where it sat has to learn again when it settles.',
      verdict: 'chosen',
      load: () => import('./option-b'),
    },
    {
      key: 'c',
      round: 'r1',
      name: 'C · Flat, by when it last changed',
      claim:
        'No groups at all. One list, newest change first, the feature as a small tag on the row, and a filter row above that narrows by feature or by open.',
      cost: 'The list reorders itself while the reader works, and nothing shows how a feature is doing as a whole.',
      verdict: 'rejected',
      load: () => import('./option-c'),
    },
  ],
});
