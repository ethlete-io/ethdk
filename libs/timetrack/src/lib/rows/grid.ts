const onLocalGrid = (step: (value: number) => number) => (ms: number, incrementMs: number) => {
  const offsetMs = -new Date(ms).getTimezoneOffset() * 60_000;

  return step((ms + offsetMs) / incrementMs) * incrementMs - offsetMs;
};

/**
 * The increment boundary at or below an instant, on the local clock rather than the UTC epoch, so a
 * 30- or 60-minute grid still lands on the local half hour or hour in a zone offset by :30 or :45.
 */
export const floorToGrid = onLocalGrid(Math.floor);

export const nearestOnGrid = onLocalGrid(Math.round);

export const ceilToGrid = onLocalGrid(Math.ceil);
