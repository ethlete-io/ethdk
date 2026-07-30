import { Component, computed, inject, input, ViewEncapsulation } from '@angular/core';
import { injectHasTouchInput } from '@ethlete/core';
import { CHECK_ICON, provideIcons } from '../../../icon';
import { MENU_IMPORTS } from '../../../menu';
import { RichTextEditorDirective } from '../../rich-text-editor';
import { MultiLanguageRichTextEditorDirective } from '../headless/multi-language-rich-text-editor.directive';

@Component({
  selector: 'et-multi-language-rich-text-editor-language-tool',
  templateUrl: './multi-language-rich-text-editor-language-tool.component.html',
  styleUrl: './multi-language-rich-text-editor-language-tool.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...MENU_IMPORTS],
  providers: [provideIcons(CHECK_ICON)],
  host: { class: 'et-ml-rte-lang-tool' },
})
export class MultiLanguageRichTextEditorLanguageToolComponent {
  private wrapper = inject(MultiLanguageRichTextEditorDirective, { optional: true });
  /** On touch, open the menu without stealing focus so the keyboard (and docked toolbar) stay put. */
  protected hasTouchInput = injectHasTouchInput();

  public editor = input.required<RichTextEditorDirective>();

  /** The editor's strings — the switcher is part of that editor's toolbar. */
  protected labels = computed(() => this.editor().resolvedLabels());

  protected languages = computed(() => this.wrapper?.languages() ?? []);
  protected activeCode = computed(() => this.wrapper?.activeLanguage() ?? '');
  protected activeLabel = computed(
    () => this.languages().find((language) => language.code === this.activeCode())?.label ?? this.activeCode(),
  );

  protected missingCount = computed(() => this.wrapper?.missingLanguages().length ?? 0);

  protected disabled = computed(
    () => this.editor().disabled() || this.editor().readonly() || this.languages().length === 0,
  );

  /** The active language shows a leading check; others show no leading marker. */
  protected activeIcon(code: string) {
    return code === this.activeCode() ? 'et-check' : null;
  }

  protected isFilled(code: string) {
    return this.wrapper?.isFilled(code) ?? false;
  }

  protected select(value: unknown) {
    this.wrapper?.activeLanguage.set(value as string);
    // the menu overlay pulled focus off the editor; hand it back (deferred so it wins over the
    // menu's own focus restoration on close) so the re-applied selection stays live in the editor
    queueMicrotask(() => this.editor().activate());
  }
}
