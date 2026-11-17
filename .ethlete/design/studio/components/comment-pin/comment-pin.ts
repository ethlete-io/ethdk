import { definePart, drawing } from '@design-system';
import { grid, pin, type Props, states } from './shared/comment-pin';

export type { Props } from './shared/comment-pin';

export const commentPinMark = (props: Props) => pin(props);

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/comment-pin/comment-pin.component.ts',
  note: "Merged variant a of Count alignment: the count is a badge on the teardrop's head.",
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  styles: '',
  states,
  grid,
  describe: {
    initials:
      'The teardrop pin with the initial H; check the hairline ring, the muted letter and that the point sits at the bottom left.',
    logo: 'The pin of a Claude comment; check that the logo replaces the initial and fits inside the teardrop.',
    selected:
      'The selected H pin; check the accent fill, the 2px ring with its soft halo and the letter on the accent.',
    'selected-logo':
      'The selected Claude pin; check the accent ring and halo around the surface fill and that the logo stays visible.',
    count: 'The H pin of a thread with 3 messages; check the accent count badge on the head of the teardrop.',
    'logo-count': 'The Claude pin with 3 messages; check that the count badge does not cover the logo.',
    'selected-count': 'The selected H pin with 3 messages; check that the badge stays readable against the halo.',
    'selected-logo-count': 'The selected Claude pin with 3 messages; check the badge on the head and the accent ring.',
    'count-12': 'The H pin with 12 messages; check that the two-digit badge widens as a pill and stays on the head.',
    'selected-logo-count-12':
      'The selected Claude pin with 12 messages; check that the wide badge does not cover the logo.',
    resolved: 'A resolved thread; check the muted check mark in place of the initial and that no count badge shows.',
    'selected-resolved': 'The selected resolved pin; check the muted 2px ring and the check mark, without the accent.',
    'initials-hover':
      'The H pin hovered; check that the letter or logo and the ring darken and the face takes a faint fill.',
    'initials-active': 'The H pin pressed; check the stronger press fill on the face.',
    'initials-focus-visible': 'The H pin focused by keyboard; check the focus ring 2px outside the teardrop.',
    'logo-hover':
      'The Claude pin hovered; check that the letter or logo and the ring darken and the face takes a faint fill.',
    'logo-active': 'The Claude pin pressed; check the stronger press fill on the face.',
    'logo-focus-visible': 'The Claude pin focused by keyboard; check the focus ring 2px outside the teardrop.',
    'selected-hover': 'The selected H pin hovered; check that the accent fill lightens to its hover tone.',
    'selected-active': 'The selected H pin pressed; check that the accent fill darkens to its press tone.',
    'selected-focus-visible':
      'The selected H pin focused by keyboard; check the focus ring outside the halo, not touching it.',
    'selected-logo-hover': 'The selected Claude pin hovered; check the faint fill on the face inside the accent ring.',
    'selected-logo-active': 'The selected Claude pin pressed; check the stronger press fill on the face.',
    'selected-logo-focus-visible':
      'The selected Claude pin focused by keyboard; check the focus ring outside the halo, not touching it.',
    'count-hover':
      'The H pin with a count hovered; check that the letter or logo and the ring darken and the face takes a faint fill.',
    'count-active': 'The H pin with a count pressed; check the stronger press fill on the face.',
    'count-focus-visible': 'The H pin with a count focused by keyboard; check the focus ring 2px outside the teardrop.',
    'logo-count-hover':
      'The Claude pin with a count hovered; check that the letter or logo and the ring darken and the face takes a faint fill.',
    'logo-count-active': 'The Claude pin with a count pressed; check the stronger press fill on the face.',
    'logo-count-focus-visible':
      'The Claude pin with a count focused by keyboard; check the focus ring 2px outside the teardrop.',
    'selected-count-hover':
      'The selected H pin with a count hovered; check that the accent fill lightens to its hover tone.',
    'selected-count-active':
      'The selected H pin with a count pressed; check that the accent fill darkens to its press tone.',
    'selected-count-focus-visible':
      'The selected H pin with a count focused by keyboard; check the focus ring outside the halo, not touching it.',
    'selected-logo-count-hover':
      'The selected Claude pin with a count hovered; check the faint fill on the face inside the accent ring.',
    'selected-logo-count-active':
      'The selected Claude pin with a count pressed; check the stronger press fill on the face.',
    'selected-logo-count-focus-visible':
      'The selected Claude pin with a count focused by keyboard; check the focus ring outside the halo, not touching it.',
    'count-12-hover':
      'The H pin with 12 hovered; check that the letter or logo and the ring darken and the face takes a faint fill.',
    'count-12-active': 'The H pin with 12 pressed; check the stronger press fill on the face.',
    'count-12-focus-visible': 'The H pin with 12 focused by keyboard; check the focus ring 2px outside the teardrop.',
    'selected-logo-count-12-hover':
      'The selected Claude pin with 12 hovered; check the faint fill on the face inside the accent ring.',
    'selected-logo-count-12-active':
      'The selected Claude pin with 12 pressed; check the stronger press fill on the face.',
    'selected-logo-count-12-focus-visible':
      'The selected Claude pin with 12 focused by keyboard; check the focus ring outside the halo, not touching it.',
    'resolved-hover': 'The resolved pin hovered; check that the check mark and the ring darken.',
    'resolved-active': 'The resolved pin pressed; check the press fill and the darker check mark.',
    'resolved-focus-visible': 'The resolved pin focused by keyboard; check the focus ring 2px outside the teardrop.',
    'selected-resolved-hover':
      'The selected resolved pin hovered; check that the check mark darkens and the ring stays muted.',
    'selected-resolved-active': 'The selected resolved pin pressed; check the press fill and the darker check mark.',
    'selected-resolved-focus-visible':
      'The selected resolved pin focused by keyboard; check the focus ring outside the 2px ring, not touching it.',
  },
  controls: { pin: { kind: 'button', input: ['pointer', 'keyboard'] } },
  render: (props: Props) => drawing({ body: `<span class="inline-flex p-space-2">${commentPinMark(props)}</span>` }),
});
