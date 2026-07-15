import { DOCUMENT } from '@angular/common';
import { Component, computed, inject, input, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { injectHasTouchInput, injectRenderer } from '@ethlete/core';
import { fromEvent, tap } from 'rxjs';
import { BUTTON_IMPORTS } from '../../../button';
import {
  ALIGN_CENTER_ICON,
  ALIGN_JUSTIFY_ICON,
  ALIGN_LEFT_ICON,
  ALIGN_RIGHT_ICON,
  IconDirective,
  provideIcons,
} from '../../../icon';
import { MENU_IMPORTS } from '../../../menu';
import { RichTextEditorDirective } from '../headless/rich-text-editor.directive';

export const TEXT_ALIGNS = ['left', 'center', 'right', 'justify'] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

/**
 * The opt-in alignment tool's toolbar control: a menu of block alignments (left/center/right/justify).
 * Alignment has no Markdown form, so it is persisted as a native `text-align` style on the block (or
 * table cell) and round-tripped as raw HTML by the Markdown converter. Registered via
 * `provideRichTextEditorAlignmentTool`.
 */
@Component({
  selector: 'et-rich-text-editor-align-tool',
  templateUrl: './rich-text-editor-align-tool.component.html',
  styleUrl: './rich-text-editor-align-tool.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [...BUTTON_IMPORTS, IconDirective, ...MENU_IMPORTS],
  providers: [provideIcons(ALIGN_LEFT_ICON, ALIGN_CENTER_ICON, ALIGN_RIGHT_ICON, ALIGN_JUSTIFY_ICON)],
  host: { class: 'et-rte-align-tool' },
})
export class RichTextEditorAlignToolComponent {
  private renderer = injectRenderer();
  private document = inject(DOCUMENT);
  /** On touch, open the menu without stealing focus so the keyboard (and docked toolbar) stay put. */
  protected hasTouchInput = injectHasTouchInput();

  public editor = input.required<RichTextEditorDirective>();

  protected readonly OPTIONS: { value: TextAlign; label: string; icon: string }[] = [
    { value: 'left', label: 'Align left', icon: 'et-align-left' },
    { value: 'center', label: 'Align center', icon: 'et-align-center' },
    { value: 'right', label: 'Align right', icon: 'et-align-right' },
    { value: 'justify', label: 'Justify', icon: 'et-align-justify' },
  ];

  /** Alignment of the caret's block/cell — kept live so the trigger icon and menu stay in sync. */
  protected current = signal<TextAlign>('left');
  protected currentIcon = computed(() => this.OPTIONS.find((o) => o.value === this.current())?.icon ?? 'et-align-left');
  /** Also locked inside lists: `text-align` on a list has no Markdown form and would not survive
   *  serialization, so the tool disables there instead of silently losing the alignment. */
  protected disabled = computed(
    () =>
      this.editor().disabled() ||
      this.editor().readonly() ||
      this.editor().unorderedListActive() ||
      this.editor().orderedListActive(),
  );

  constructor() {
    // track the caret's alignment as it moves so the button reflects it without needing a click
    fromEvent(this.document, 'selectionchange')
      .pipe(
        tap(() => this.current.set(this.readAlign())),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  protected select(value: unknown) {
    const align = value as TextAlign;
    const root = this.editor().editorDom.root();
    const range = this.editor().editorDom.getSelection()?.range;

    if (!root || !range || this.disabled()) return;

    // wrapping loose top-level text in a paragraph is a mutation, so it only happens here (on the
    // explicit align action) — never in readAlign, which runs on every selection change
    const blocks = this.targetBlocks(root, range) ?? this.wrapLooseContent(root, range);

    for (const block of blocks) {
      if (align === 'left') this.renderer.removeStyle(block, 'textAlign');
      else this.renderer.setStyle(block, { textAlign: align });
    }

    this.current.set(align);
    this.editor().syncFromDom();
    queueMicrotask(() => this.editor().activate());
  }

  private readAlign(): TextAlign {
    const root = this.editor().editorDom.root();
    const range = this.editor().editorDom.getSelection()?.range;

    if (!root || !range) return 'left';

    const value = this.targetBlocks(root, range)?.[0]?.style.textAlign ?? '';

    return (TEXT_ALIGNS as readonly string[]).includes(value) ? (value as TextAlign) : 'left';
  }

  /**
   * The elements alignment applies to: inside a table, the full columns the selection touches
   * (GFM table alignment is per column — the serializer reads it from the header cells, so a
   * single aligned cell would not survive), otherwise the root-level blocks. Lists are skipped —
   * their alignment has no Markdown form. Read-only — returns `null` when the selection is over
   * loose top-level text with no block to align (see {@link wrapLooseContent}).
   */
  private targetBlocks(root: HTMLElement, range: Range): HTMLElement[] | null {
    // eslint-disable-next-line ethlete/no-dom-query -- cells carry no unique hook; an atomic tag query is simplest
    const cells = [...root.querySelectorAll<HTMLElement>('th, td')].filter((cell) => range.intersectsNode(cell));

    if (cells.length > 0) return this.expandToColumns(cells);

    const blocks: HTMLElement[] = [];

    for (const child of root.children) {
      if (child instanceof HTMLElement && range.intersectsNode(child)) {
        if (child.tagName === 'UL' || child.tagName === 'OL') continue;

        blocks.push(child);
      }
    }

    return blocks.length > 0 ? blocks : null;
  }

  /** Every cell of the columns the given cells belong to, so alignment applies column-wide. */
  private expandToColumns(cells: HTMLElement[]): HTMLElement[] {
    const out = new Set<HTMLElement>();

    for (const cell of cells) {
      if (!(cell instanceof HTMLTableCellElement)) continue;

      let table: HTMLElement | null = cell;

      while (table && !(table instanceof HTMLTableElement)) table = table.parentElement;

      if (!(table instanceof HTMLTableElement)) continue;

      for (const row of table.rows) {
        const columnCell = row.cells[cell.cellIndex];

        if (columnCell) out.add(columnCell);
      }
    }

    return [...out];
  }

  /** Wraps the loose top-level nodes the selection touches in a paragraph (the editor doesn't wrap
   *  the first typed line until Enter) so there is a block to align. Mutates — call only on action. */
  private wrapLooseContent(root: HTMLElement, range: Range): HTMLElement[] {
    const loose = [...root.childNodes].filter((node) => range.intersectsNode(node));

    if (loose.length === 0 || !loose[0]) return [];

    const paragraph = this.renderer.createElement('p') as HTMLElement;
    this.renderer.insertBefore(root, paragraph, loose[0]);
    for (const node of loose) this.renderer.appendChild(paragraph, node);

    return [paragraph];
  }
}
