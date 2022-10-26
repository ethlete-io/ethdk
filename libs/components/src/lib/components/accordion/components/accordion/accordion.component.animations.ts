import { animate, state, style, transition, trigger } from '@angular/animations';

export const accordionAnimations = {
  animateOpenClose: trigger('animateOpenClose', [
    state('close, void', style({ height: '0px', visibility: 'hidden' })),
    state('open', style({ height: '*', visibility: 'visible' })),
    transition('open <=> close, void => close', animate('300ms cubic-bezier(0.25, 0, 0.1, 1)')),
  ]),
};
