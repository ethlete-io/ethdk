import { Band } from '../../../kerbe';

/** A work lane at its resting width, so nothing here is also answering the narrow-lane call. */
export const LANE_REM = 26;

/** The app books in 15m increments, so these are the real lengths a day produces. */
const MINUTES = [15, 30, 45, 60];

export const BANDS: Band[] = MINUTES.map((minutes) => ({
  id: 'm' + minutes,
  kind: 'work',
  ask: 'a glance',
  from: '10:00',
  minutes,
  label: 'ET-772',
  detail: 'fix(repo): Cut the inlay instead of breaking it',
}));
