/** One call as the explorer lists it. */
export type ShellCall = {
  eyebrow: string;
  headline: string;
  settled: string;
  open?: boolean;
};

/** The data every option of this call draws. An option may read it and may not change it. */
export const shell = {
  checkout: '/home/tom/dev/ethlete-sdk',
  project: 'fifagg',
  projects: ['fifagg', 'kerbe', 'studio', 'design-tool'],
  server: 'Design server 4402 · running',
  agent: 'Claude Code 1.1.276',
  features: [
    {
      name: 'competition navigation',
      open: 2,
      calls: [
        {
          eyebrow: 'Fifagg · call 17',
          headline: 'What does the phone row carry, now that the name is not its job?',
          settled: '0 of 3 settled',
        },
        {
          eyebrow: 'Fifagg · call 16',
          headline: 'How does the row carry a 72-character competition name?',
          settled: '3 of 6 settled',
          open: true,
        },
        {
          eyebrow: 'Fifagg · call 15',
          headline: 'What opens when the competition row is used?',
          settled: '3 of 3 settled',
        },
        {
          eyebrow: 'Fifagg · call 14',
          headline: 'How does the row carry a long competition name with no icon asset?',
          settled: '3 of 3 settled',
        },
      ] as ShellCall[],
    },
    {
      name: 'No feature',
      open: 1,
      calls: [
        {
          eyebrow: 'Fifagg · call 8',
          headline: 'How much navigation should competition mode expose at rest?',
          settled: '8 of 11 settled',
        },
      ] as ShellCall[],
    },
  ],
  call: {
    eyebrow: 'Fifagg · call 16',
    headline: 'How does the row carry a 72-character competition name?',
    round: 'Round 2 · Somebody else gives way',
    variants: [
      { key: 'a', name: 'A · The page, then the stage', verdict: 'rejected' },
      { key: 'b', name: 'B · The stage, then the pages', verdict: '' },
      { key: 'c', name: 'C · One line, the control names the page', verdict: '' },
    ],
  },
  verbs: ['Accept', 'Iterate', 'Reject', 'More like this', 'Open again'],
  chat: 'Nothing said in this call yet.',
};
