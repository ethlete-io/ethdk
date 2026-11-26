import { differenceOf } from './png.mjs';

const MIN_COPIES = 3;

/**
 * Groups of at least three states of one variant whose pictures differ but come out pixel-equal once their text is
 * emptied (`textless`): each state only changes its words and draws nothing of its own.
 */
export const textOnlyCopiesOf = (states) => {
  const left = states.filter((shot) => shot.textless && shot.picture);
  const groups = [];
  while (left.length) {
    const [one] = left.splice(0, 1);
    const same = left.filter((two) => differenceOf(one.textless, two.textless) === 0);
    for (const shot of same) left.splice(left.indexOf(shot), 1);
    const group = [one, ...same];
    const differ = group.some((two) => differenceOf(one.picture, two.picture) > 0);
    if (group.length >= MIN_COPIES && differ) groups.push(group);
  }
  return groups;
};
