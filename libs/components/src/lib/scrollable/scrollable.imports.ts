import { ScrollableActiveChildDirective } from './headless/scrollable-active-child.directive';
import { ScrollableButtonsDirective } from './headless/scrollable-buttons.directive';
import { ScrollableDarkenDirective } from './headless/scrollable-darken.directive';
import { ScrollableDragDirective } from './headless/scrollable-drag.directive';
import { ScrollableIgnoreChildDirective } from './headless/scrollable-ignore-child.directive';
import { ScrollableLoadingTemplateDirective } from './headless/scrollable-loading-template.directive';
import { ScrollableNavigationDirective } from './headless/scrollable-navigation.directive';
import { ScrollableSnapDirective } from './headless/scrollable-snap.directive';
import { ScrollableComponent } from './scrollable.component';

/**
 * The base scrollable: the track, its edge masks, the loading template and the active-child /
 * ignore-child markers. Deliberately lean - the chrome and the gestures ship as their own imports
 * arrays, so a track you only scroll never pulls in the buttons' icon button or the drag primitives.
 */
export const SCROLLABLE_IMPORTS = [
  ScrollableComponent,
  ScrollableActiveChildDirective,
  ScrollableIgnoreChildDirective,
  ScrollableLoadingTemplateDirective,
] as const;

/**
 * The scrollable's decorative chrome, applied on the `<et-scrollable>` itself: `etScrollableButtons` for
 * the previous/next buttons, `etScrollableNavigation` for the dots. Pulls in the icon button (and with it
 * the spinner), which is why it is separate.
 */
export const SCROLLABLE_NAVIGATION_IMPORTS = [ScrollableButtonsDirective, ScrollableNavigationDirective] as const;

/**
 * Pointer gestures on the track: `etScrollableDrag` to drag it with a mouse, `etScrollableSnap` to come to
 * rest on a child. Paired because a mouse release has no momentum for native snap to decelerate into, so
 * snapping settles the drag itself - see `ScrollableSnapDirective`.
 */
export const SCROLLABLE_DRAG_IMPORTS = [ScrollableDragDirective, ScrollableSnapDirective] as const;

/** `etScrollableDarken`: fade the children that are only partly in view. */
export const SCROLLABLE_DARKEN_IMPORTS = [ScrollableDarkenDirective] as const;
