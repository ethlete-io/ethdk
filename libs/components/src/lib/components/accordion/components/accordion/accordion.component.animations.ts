import { animate, state, style, transition, trigger } from '@angular/animations';

export const EXPANSION_PANEL_ANIMATION_TIMING = '225ms cubic-bezier(0.4,0.0,0.2,1)';

export const accordionAnimations = {
  animateOpenClose: trigger('animateOpenClose', [
    state('close, void', style({ height: '0px', visibility: 'hidden' })),
    state('open', style({ height: '*', visibility: 'visible' })),
    transition('open <=> close, void => close', animate(EXPANSION_PANEL_ANIMATION_TIMING)),
  ]),
};
