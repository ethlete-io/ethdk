import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { BUTTON_IMPORTS } from '../../button';
import { RichTextEditorDirective } from './headless';
import { resolveTriggerItems } from './headless/internals/rich-text-editor-trigger-source';
import { RichTextEditorTrigger, RichTextEditorTriggerItem } from './rich-text-editor-trigger';

/** A trigger and the items it currently offers, rendered as one run of chip buttons. */
type RichTextEditorTokenPaletteGroup = {
  trigger: RichTextEditorTrigger;
  items: readonly RichTextEditorTriggerItem[];
};

/**
 * An opt-in row of click-to-insert token chips, driven by the same `RichTextEditorTrigger[]` as the
 * `#`/`@` popup. Clicking a chip inserts its `{{type:id}}` token into the bound editor at the caret
 * (via {@link RichTextEditorDirective.insertTokenItem}) — the palette equivalent of picking it from
 * the popup — so apps get a merge-field/placeholder palette without re-implementing chip rendering,
 * label resolution, or caret handling.
 *
 * Point it at the editor with `[editor]` (a template ref to the `[etRichTextEditor]` directive) and
 * pass the trigger config with `[triggers]`. Only items available for an empty query are shown, so
 * static-array sources list all their items while search-only (`minQueryLength`) sources stay empty
 * — a palette is for fixed sets, not search. The editor must have a token codec installed (by
 * `[etRichTextEditorTriggers]` or `provideRichTextEditorTokenRendering`) so tokens (de)serialize.
 *
 * ```html
 * <et-rich-text-editor #rte="etRichTextEditor" [triggers]="triggers" etRichTextEditorTriggers />
 * <et-rich-text-editor-token-palette [editor]="rte" [triggers]="triggers" />
 * ```
 */
@Component({
  selector: 'et-rich-text-editor-token-palette',
  templateUrl: './rich-text-editor-token-palette.component.html',
  styleUrl: './rich-text-editor-token-palette.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...BUTTON_IMPORTS],
  host: {
    class: 'et-rte-token-palette',
    role: 'group',
    '[attr.aria-label]': 'label()',
  },
})
export class RichTextEditorTokenPaletteComponent {
  /** The editor to insert into — a template ref to its `[etRichTextEditor]` directive. */
  public editor = input.required<RichTextEditorDirective>();

  /** The triggers whose items become chip buttons. Use the same array as the editor's triggers. */
  public triggers = input<readonly RichTextEditorTrigger[]>([]);

  /** Accessible name for the palette group. */
  public label = input('Insert token');

  /** Focus the editor after inserting so the user can keep typing. */
  public focusEditorOnInsert = input(true);

  private groups = toSignal(
    toObservable(this.triggers).pipe(
      switchMap((triggers) =>
        triggers.length === 0
          ? of<RichTextEditorTokenPaletteGroup[]>([])
          : combineLatest(
              triggers.map((trigger) =>
                resolveTriggerItems(trigger, '').pipe(
                  // a failing source drops to an empty run rather than blanking the whole palette
                  catchError(() => of<RichTextEditorTriggerItem[]>([])),
                  map((items): RichTextEditorTokenPaletteGroup => ({ trigger, items })),
                ),
              ),
            ),
      ),
    ),
    { initialValue: [] as RichTextEditorTokenPaletteGroup[] },
  );

  /** Only groups that actually have items to offer — empty (e.g. search-only) triggers are dropped. */
  protected visibleGroups = computed(() => this.groups().filter((group) => group.items.length > 0));

  /** Chips are inert while the editor can't take an edit. */
  protected editorInactive = computed(() => this.editor().disabled() || this.editor().readonly());

  protected insert(trigger: RichTextEditorTrigger, item: RichTextEditorTriggerItem) {
    if (item.disabled || this.editorInactive()) return;

    this.editor().insertTokenItem(trigger.type, item, { focus: this.focusEditorOnInsert() });
  }
}
