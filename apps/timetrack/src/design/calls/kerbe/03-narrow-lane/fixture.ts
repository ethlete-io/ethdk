import { Band } from '../../../kerbe';

/** The break lane is 6rem. A work lane falls to its 14rem minimum only in a small window. */
export const LANE_REM = 6;

export const BANDS: Band[] = [
  { id: 'b15', kind: 'break', ask: 'nothing', from: '12:15', minutes: 15, label: 'Break' },
  { id: 'b30', kind: 'break', ask: 'nothing', from: '13:00', minutes: 30, label: 'Break' },
  { id: 'b45', kind: 'break', ask: 'nothing', from: '15:30', minutes: 45, label: 'Break' },
  { id: 'w45', kind: 'work', ask: 'a glance', from: '16:30', minutes: 45, label: 'Toty public fixes' },
];
