import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { BUTTON_IMPORTS, CIRCLE_INFO_ICON, ICON_IMPORTS, TOGGLETIP_IMPORTS, provideIcons } from '@ethlete/components';

/**
 * The long answer to "why is this setting here", behind one glyph.
 *
 * Most settings in this app need a paragraph to be safe to change: what a wrong value costs is rarely
 * visible from the field. Printing every one of those paragraphs turns the screen into a document
 * nobody reads, and reading none of them is how a wrong worklog gets configured — so the text stays,
 * one press away, next to the thing it is about.
 */
@Component({
  selector: 'ethlete-explain',
  template: `
    <button
      [etToggletip]="body"
      [etToggletipAriaLabel]="'Why: ' + label()"
      [attr.aria-label]="'Why: ' + label()"
      et-button
      etToggletipTrigger
      variant="transparent"
      size="sm"
      type="button"
    >
      <i etIcon="et-circle-info"></i>
    </button>

    <ng-template #body>
      <div class="flex max-w-90 flex-col gap-2" data-toggletip-body>
        @for (paragraph of paragraphs(); track $index) {
          <p class="text-small">{{ paragraph }}</p>
        }
      </div>
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, ICON_IMPORTS, TOGGLETIP_IMPORTS],
  providers: [provideIcons(CIRCLE_INFO_ICON)],
  host: { class: 'inline-flex' },
})
export class ExplainComponent {
  /** What the explanation is about, for the button's own accessible name. */
  public label = input.required<string>();
  public text = input.required<string>();

  /**
   * The text as paragraphs. They are written as a blank line in the source, and a toggletip given a
   * plain string renders every one of them as one wall — which is the thing this component exists to
   * stop.
   */
  protected paragraphs = computed(() =>
    this.text()
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
      .filter(Boolean),
  );
}
