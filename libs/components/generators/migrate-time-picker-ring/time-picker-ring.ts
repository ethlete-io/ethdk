import { RemovedExport } from '../removed-exports/removed-exports.js';

const GUIDE = 'See the time picker guide (/components/time-picker).';

export const TIME_PICKER_RING_REMOVALS: readonly RemovedExport[] = [
  {
    name: 'TimePickerColumnDirective',
    dropFromArrays: ['imports'],
    todo: `TimePickerColumnDirective is removed; the time picker is a ring. ${GUIDE}`,
  },
  {
    name: 'TimePickerOptionDirective',
    dropFromArrays: ['imports'],
    todo: `TimePickerOptionDirective is removed; the time picker is a ring. ${GUIDE}`,
  },
];

export const REMOVED_SELECTORS = /\betTimePicker(?:Column|Option)\b/;

const TIME_PICKER_USE = /TimePicker|etTimePicker|et-time-picker/;
const SET_ACTIVE_SIDE = /(\.\s*)setActiveSide(\s*\()/g;

export const mentionsTimePicker = (content: string) => TIME_PICKER_USE.test(content);

/** Returns the source or template with every `.setActiveSide(` call turned into `.activeSide.set(`, or `null` when there is none. */
export const replaceSetActiveSide = (content: string): string | null => {
  if (!mentionsTimePicker(content)) return null;

  const next = content.replace(SET_ACTIVE_SIDE, '$1activeSide.set$2');

  return next === content ? null : next;
};
