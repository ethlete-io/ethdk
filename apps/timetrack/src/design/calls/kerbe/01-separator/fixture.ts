import { Band } from '../../../kerbe';

/** The lane width the app gives one. */
export const LANE_REM = 24;

export const BANDS: Band[] = [
  {
    id: 'e1',
    kind: 'work',
    ask: 'nothing',
    from: '08:45',
    minutes: 45,
    label: 'ET-772',
    detail: 'feat(agent-rules): Fire the context warning',
  },
  {
    id: 'e1b',
    kind: 'work',
    ask: 'nothing',
    from: '09:30',
    minutes: 30,
    label: 'ET-772',
    detail: 'test(agent-rules): Cover the three call sites',
  },
  {
    id: 'e2',
    kind: 'work',
    ask: 'a glance',
    from: '10:00',
    minutes: 45,
    label: 'ET-772',
    detail: 'fix(repo): Cut the inlay instead of breaking it',
  },
  {
    id: 'e3',
    kind: 'work',
    ask: 'nothing',
    from: '10:45',
    minutes: 90,
    label: 'ET-772',
    detail: 'feat(repo): Pick Inlay as the band direction',
  },
];
