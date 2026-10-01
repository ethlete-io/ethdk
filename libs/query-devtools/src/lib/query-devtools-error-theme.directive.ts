import { Directive } from '@angular/core';
import { injectSemanticColorTheme } from '@ethlete/core';

/**
 * The error theme of the surface this element renders on. A menu's content is declared by the component that owns
 * the trigger, so it must read the theme here, inside the detached menu panel, and not from that component.
 *
 * @internal
 */
@Directive({
  selector: '[etQueryDevtoolsErrorTheme]',
  exportAs: 'etQueryDevtoolsErrorTheme',
})
export class QueryDevtoolsErrorThemeDirective {
  public theme = injectSemanticColorTheme('error');
}
