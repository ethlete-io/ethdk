/** The closing line of an e2e run: the one-minute load at its start and end, and "noisy" when either is above the cores. */
export const runLoadLineOf = ({ start, end, cores }) =>
  `load ${start.toFixed(1)} at start, ${end.toFixed(1)} at end on ${cores} cores${Math.max(start, end) > cores ? ' - noisy, not a measurement' : ''}`;
