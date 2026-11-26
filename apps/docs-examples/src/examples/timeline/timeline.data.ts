export const TIMELINE_EVENTS = [
  {
    time: '18:30',
    label: 'Squad announced',
    description: 'Both line-ups published 60 minutes before kickoff.',
    icon: 'et-clock',
    color: null,
  },
  {
    time: "23'",
    label: 'Goal by A. Rossi',
    description: 'Assisted by M. Keller after a counter down the left.',
    icon: 'et-circle-check',
    color: 'success',
  },
  {
    time: "67'",
    label: 'Second yellow for L. Turner',
    description: 'Sent off; the home side plays the rest a player down.',
    icon: 'et-triangle-exclamation',
    color: 'danger',
  },
  {
    time: "90+4'",
    label: 'Fulltime - 2:1',
    description: 'The visitors take all three points and go top of the table.',
    icon: 'et-trophy',
    color: 'brand',
  },
] as const;
