import { Directive } from '@angular/core';

/**
 * Marks a descendant as NOT counting toward an ancestor's `ColorInteractiveDirective`
 * `:hover`/`:active` reaction (via the `:has()` guard in color-interactive-styles.component.css).
 * Use it for content that's incidentally inside an interactive ancestor but isn't part of what
 * makes that ancestor interactive — e.g. a hint/error block sitting inside a form field's frame.
 *
 * This only suppresses the ancestor's OWN reaction to hovering/pressing the excluded element — it
 * has no effect on custom-property inheritance into descendants past the excluded element. If
 * what you actually need is "stop my own cosmetic styling from reacting to a parent's unrelated
 * interaction," this is the wrong tool; that's the class of bug `ColorInteractiveHasFocusDirective`
 * used to have (see its own comment).
 */
@Directive({
  selector: '[etColorInteractiveExclude]',
  host: {
    class: 'et-color-interactive-exclude',
  },
})
export class ColorInteractiveExcludeDirective {}
