/** One call as the explorer lists it. */
export type ExplorerCall = {
  /** The feature it belongs to. A loose call says 'No feature'. */
  feature: string;
  eyebrow: string;
  headline: string;
  /** How many of its rounds have ruled, and how many it has. */
  settled: number;
  rounds: number;
  /** How long ago it last changed, as the explorer writes it. */
  touched: string;
  /** The call the reader is on. Exactly one is true. */
  open?: boolean;
};

/** The data every option of this call draws. An option may read it and may not change it. */
export const explorer = {
  project: 'fifagg',
  projects: ['fifagg', 'kerbe', 'studio', 'design-tool'],
  /** The order the features were last worked in, newest first. */
  features: ['competition navigation', 'the match page', 'onboarding', 'No feature'],
  calls: [
    {
      feature: 'competition navigation',
      eyebrow: 'Fifagg · call 17',
      headline: 'What does the phone row carry, now that the name is not its job?',
      settled: 0,
      rounds: 3,
      touched: '2 minutes ago',
    },
    {
      feature: 'competition navigation',
      eyebrow: 'Fifagg · call 16',
      headline: 'How does the row carry a 72-character competition name?',
      settled: 3,
      rounds: 6,
      touched: '18 minutes ago',
      open: true,
    },
    {
      feature: 'competition navigation',
      eyebrow: 'Fifagg · call 15',
      headline: 'What opens when the competition row is used?',
      settled: 3,
      rounds: 3,
      touched: 'yesterday',
    },
    {
      feature: 'competition navigation',
      eyebrow: 'Fifagg · call 14',
      headline: 'How does the row carry a long competition name with no icon asset?',
      settled: 3,
      rounds: 3,
      touched: 'yesterday',
    },
    {
      feature: 'the match page',
      eyebrow: 'Fifagg · call 13',
      headline: 'Where does the live score sit while the match page scrolls?',
      settled: 1,
      rounds: 4,
      touched: '3 hours ago',
    },
    {
      feature: 'the match page',
      eyebrow: 'Fifagg · call 12',
      headline: 'How does the lineup read on a phone held one-handed?',
      settled: 4,
      rounds: 4,
      touched: '2 days ago',
    },
    {
      feature: 'the match page',
      eyebrow: 'Fifagg · call 11',
      headline: 'What does the page show before the first whistle?',
      settled: 2,
      rounds: 2,
      touched: '2 days ago',
    },
    {
      feature: 'onboarding',
      eyebrow: 'Fifagg · call 10',
      headline: 'How many steps does a new account need before it sees a match?',
      settled: 0,
      rounds: 2,
      touched: '4 days ago',
    },
    {
      feature: 'onboarding',
      eyebrow: 'Fifagg · call 9',
      headline: 'What does the empty state say to an account that follows nobody?',
      settled: 3,
      rounds: 3,
      touched: 'last week',
    },
    {
      feature: 'No feature',
      eyebrow: 'Fifagg · call 8',
      headline: 'How much navigation should competition mode expose at rest?',
      settled: 8,
      rounds: 11,
      touched: '5 hours ago',
    },
    {
      feature: 'No feature',
      eyebrow: 'Fifagg · call 4',
      headline: 'Which surface does a sheet sit on over a dark page?',
      settled: 2,
      rounds: 2,
      touched: 'last week',
    },
  ] as ExplorerCall[],
  search: 'Search calls',
};
