import { animate, AnimationTriggerMetadata, state, style, transition, trigger } from '@angular/animations';

export const tabAnimations: {
  readonly translateTab: AnimationTriggerMetadata;
} = {
  translateTab: trigger('translateTab', [
    state('center, void, left-origin-center, right-origin-center', style({ transform: 'none' })),

    state(
      'left',
      style({
        minHeight: '1px',
        visibility: 'hidden',
      }),
    ),
    state(
      'right',
      style({
        minHeight: '1px',
        visibility: 'hidden',
      }),
    ),

    transition(
      '* => left, * => right, left => center, right => center',
      animate('{{animationDuration}} cubic-bezier(0.35, 0, 0.25, 1)'),
    ),
    transition('void => left-origin-center', [
      style({ transform: 'translate3d(-100%, 0, 0)', visibility: 'hidden' }),
      animate('{{animationDuration}} cubic-bezier(0.35, 0, 0.25, 1)'),
    ]),
    transition('void => right-origin-center', [
      style({ transform: 'translate3d(100%, 0, 0)', visibility: 'hidden' }),
      animate('{{animationDuration}} cubic-bezier(0.35, 0, 0.25, 1)'),
    ]),
  ]),
};
