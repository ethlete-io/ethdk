import { Directive } from '@angular/core';
import { injectSemanticThemes } from './semantic-theme';

/**
 * Resolves the semantic themes from the element it sits on. Content that a component declares but stamps into a
 * detached overlay panel must read them through this directive on the panel, not from the declaring component,
 * which sits on the trigger's surface.
 */
@Directive({
  selector: '[etSemanticThemes]',
  exportAs: 'etSemanticThemes',
})
export class SemanticThemesDirective {
  public themes = injectSemanticThemes();
}
