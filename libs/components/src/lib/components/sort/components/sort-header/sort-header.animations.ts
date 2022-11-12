import {
  animate,
  state,
  style,
  transition,
  trigger,
  keyframes,
  AnimationTriggerMetadata,
  query,
  animateChild,
} from '@angular/animations';

class AnimationCurves {
  static STANDARD_CURVE = 'cubic-bezier(0.4,0.0,0.2,1)';
  static DECELERATION_CURVE = 'cubic-bezier(0.0,0.0,0.2,1)';
  static ACCELERATION_CURVE = 'cubic-bezier(0.4,0.0,1,1)';
  static SHARP_CURVE = 'cubic-bezier(0.4,0.0,0.6,1)';
}

class AnimationDurations {
  static COMPLEX = '375ms';
  static ENTERING = '225ms';
  static EXITING = '195ms';
}

const SORT_ANIMATION_TRANSITION = AnimationDurations.ENTERING + ' ' + AnimationCurves.STANDARD_CURVE;

export const sortAnimations: {
  readonly indicator: AnimationTriggerMetadata;
  readonly leftPointer: AnimationTriggerMetadata;
  readonly rightPointer: AnimationTriggerMetadata;
  readonly arrowOpacity: AnimationTriggerMetadata;
  readonly arrowPosition: AnimationTriggerMetadata;
  readonly allowChildren: AnimationTriggerMetadata;
} = {
  indicator: trigger('indicator', [
    state('active-asc, asc', style({ transform: 'translateY(0px)' })),
    state('active-desc, desc', style({ transform: 'translateY(10px)' })),
    transition('active-asc <=> active-desc', animate(SORT_ANIMATION_TRANSITION)),
  ]),

  leftPointer: trigger('leftPointer', [
    state('active-asc, asc', style({ transform: 'rotate(-45deg)' })),
    state('active-desc, desc', style({ transform: 'rotate(45deg)' })),
    transition('active-asc <=> active-desc', animate(SORT_ANIMATION_TRANSITION)),
  ]),

  rightPointer: trigger('rightPointer', [
    state('active-asc, asc', style({ transform: 'rotate(45deg)' })),
    state('active-desc, desc', style({ transform: 'rotate(-45deg)' })),
    transition('active-asc <=> active-desc', animate(SORT_ANIMATION_TRANSITION)),
  ]),

  arrowOpacity: trigger('arrowOpacity', [
    state('desc-to-active, asc-to-active, active', style({ opacity: 1 })),
    state('desc-to-hint, asc-to-hint, hint', style({ opacity: 0.54 })),
    state('hint-to-desc, active-to-desc, desc, hint-to-asc, active-to-asc, asc, void', style({ opacity: 0 })),
    transition('* => asc, * => desc, * => active, * => hint, * => void', animate('0ms')),
    transition('* <=> *', animate(SORT_ANIMATION_TRANSITION)),
  ]),

  arrowPosition: trigger('arrowPosition', [
    transition(
      '* => desc-to-hint, * => desc-to-active',
      animate(
        SORT_ANIMATION_TRANSITION,
        keyframes([style({ transform: 'translateY(-25%)' }), style({ transform: 'translateY(0)' })]),
      ),
    ),
    transition(
      '* => hint-to-desc, * => active-to-desc',
      animate(
        SORT_ANIMATION_TRANSITION,
        keyframes([style({ transform: 'translateY(0)' }), style({ transform: 'translateY(25%)' })]),
      ),
    ),
    transition(
      '* => asc-to-hint, * => asc-to-active',
      animate(
        SORT_ANIMATION_TRANSITION,
        keyframes([style({ transform: 'translateY(25%)' }), style({ transform: 'translateY(0)' })]),
      ),
    ),
    transition(
      '* => hint-to-asc, * => active-to-asc',
      animate(
        SORT_ANIMATION_TRANSITION,
        keyframes([style({ transform: 'translateY(0)' }), style({ transform: 'translateY(-25%)' })]),
      ),
    ),
    state(
      'desc-to-hint, asc-to-hint, hint, desc-to-active, asc-to-active, active',
      style({ transform: 'translateY(0)' }),
    ),
    state('hint-to-desc, active-to-desc, desc', style({ transform: 'translateY(-25%)' })),
    state('hint-to-asc, active-to-asc, asc', style({ transform: 'translateY(25%)' })),
  ]),

  allowChildren: trigger('allowChildren', [transition('* <=> *', [query('@*', animateChild(), { optional: true })])]),
};
