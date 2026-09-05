import { Component, computed, effect, ElementRef, input, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { injectErrorTheme, injectStyleManager, ProvideColorDirective } from '@ethlete/core';
import {
  armQueryDevtoolsOverrideTransfer,
  countUnresolvedQueryDevtoolsOverrides,
  parseQueryDevtoolsOverrideTransfer,
  QueryDevtoolsOverridesRecorder,
  serializeQueryDevtoolsOverrideTransfer,
} from '@ethlete/query';
import { MenuComponent, MenuDirective, MenuItemComponent, MenuItemShortcutComponent } from '@ethlete/components';
import { MenuSearchDirective, MenuSurfaceDirective, MenuTriggerDirective } from '@ethlete/components';
import {
  readQueryDevtoolsClipboard,
  textFromQueryDevtoolsPaste,
  writeQueryDevtoolsClipboard,
} from './query-devtools-clipboard';
import { QueryDevtoolsOverrideMenuStylesComponent } from './query-devtools-override-menu-styles.component';

/**
 * Copies the whole set of response overrides armed on one query to the clipboard, and pastes one back -
 * onto this query or any other. The payload is the same JSON the override store persists, so a set can
 * also go into a ticket and come back from one.
 *
 * @internal
 */
@Component({
  selector: 'et-query-devtools-override-set-menu',
  templateUrl: './query-devtools-override-set-menu.component.html',
  encapsulation: ViewEncapsulation.None,
  imports: [
    MenuDirective,
    MenuTriggerDirective,
    MenuSurfaceDirective,
    MenuSearchDirective,
    MenuComponent,
    MenuItemComponent,
    MenuItemShortcutComponent,
    ProvideColorDirective,
  ],
})
export class QueryDevtoolsOverrideSetMenuComponent {
  protected errorColorTheme = injectErrorTheme();

  public overrides = input.required<QueryDevtoolsOverridesRecorder>();

  /** The response a pasted set is measured against, to report the ops that land on nothing. */
  public response = input<unknown>();

  /** Where the set came from, carried into the payload for whoever reads it next. */
  public source = input<{ id?: string; url?: string }>();

  private pasteInput = viewChild<ElementRef<HTMLInputElement>>('pasteBox');

  protected armedCount = computed(() => this.overrides().list().length);

  protected pasteMode = signal(false);
  protected error = signal<string | null>(null);
  protected note = signal<string | null>(null);
  protected copied = signal(false);

  constructor() {
    injectStyleManager().mount(QueryDevtoolsOverrideMenuStylesComponent);

    effect(() => this.pasteInput()?.nativeElement.focus());
  }

  protected copySet() {
    const text = serializeQueryDevtoolsOverrideTransfer(this.overrides().list(), this.source());

    writeQueryDevtoolsClipboard({ text }).then((result) => {
      if (result.ok) {
        this.copied.set(true);

        return;
      }

      this.error.set(
        result.reason === 'unavailable'
          ? 'This browser will not hand over the clipboard'
          : 'The clipboard write was blocked',
      );
    });
  }

  protected pasteSet() {
    this.reset();

    readQueryDevtoolsClipboard().then((read) => {
      if (read.ok) {
        this.armText(read.text);

        return;
      }

      this.pasteMode.set(true);
      this.note.set(
        read.reason === 'unavailable'
          ? 'This browser will not hand over the clipboard - press ⌘V / Ctrl+V here instead.'
          : 'The clipboard read was blocked - press ⌘V / Ctrl+V here instead.',
      );
    });
  }

  protected pasteIntoBox(event: ClipboardEvent) {
    const text = textFromQueryDevtoolsPaste(event);
    if (!text) return;

    event.preventDefault();
    this.armText(text);
  }

  protected commitPasteBox() {
    const raw = this.pasteInput()?.nativeElement.value;

    if (raw !== undefined) this.armText(raw);
  }

  protected resetOnClose(open: boolean) {
    if (!open) {
      this.pasteMode.set(false);
      this.copied.set(false);
      this.reset();
    }
  }

  private reset() {
    this.error.set(null);
    this.note.set(null);
  }

  private armText(text: string) {
    const parsed = parseQueryDevtoolsOverrideTransfer(text);

    if (!parsed.ok) {
      this.error.set(parsed.reason);

      return;
    }

    armQueryDevtoolsOverrideTransfer(this.overrides(), parsed.ops);

    const unresolved = countUnresolvedQueryDevtoolsOverrides(parsed.ops, this.response());
    const parts = [`Armed ${parsed.ops.length} ${parsed.ops.length === 1 ? 'op' : 'ops'}`];

    if (unresolved) parts.push(`${unresolved} of them do not resolve against this response`);
    if (parsed.skipped) parts.push(`${parsed.skipped} unknown to this build were dropped`);

    this.pasteMode.set(false);
    this.error.set(null);
    this.note.set(`${parts.join('; ')}.`);
  }
}
