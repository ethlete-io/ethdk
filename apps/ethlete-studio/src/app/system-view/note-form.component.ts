import {
  Component,
  ViewEncapsulation,
  afterNextRender,
  booleanAttribute,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { BUTTON_IMPORTS, FORM_FIELD_IMPORTS, TEXTAREA_IMPORTS, TextareaComponent } from '@ethlete/components';
import { ProvideColorDirective, injectSemanticColorTheme } from '@ethlete/core';
import { draftKeyOf } from './comment-pins';
import { injectNoteStore } from './note-store';

@Component({
  selector: 'ethlete-note-form',
  template: `
    <div
      class="flex w-80 flex-col gap-2 rounded-sm border border-dashed border-surface-border bg-surface p-3 shadow-lg"
      data-note-form
      data-canvas-popover
    >
      <et-form-field appearance="box">
        <et-textarea
          [(value)]="text"
          (keydown)="handleKey($event)"
          aria-label="Note"
          placeholder="Enter saves, Shift+Enter breaks the line"
          rows="3"
        />
      </et-form-field>
      @if (store.error(); as message) {
        <p [etProvideColor]="errorTheme()" class="m-0 text-small text-(--et-theme-color-primary-solid)">
          {{ message }}
        </p>
      }
      <div class="flex justify-end gap-2">
        @if (changing()) {
          <button
            [disabled]="store.busy()"
            (click)="store.remove()"
            class="mr-auto"
            et-button
            type="button"
            variant="transparent"
            color="surface"
            size="xs"
          >
            Delete
          </button>
        }
        <button (click)="store.cancel()" et-button type="button" variant="transparent" color="surface" size="xs">
          Cancel
        </button>
        <button
          [disabled]="store.busy() || text().trim() === ''"
          (click)="submit()"
          et-button
          type="button"
          variant="filled"
          size="xs"
        >
          Save
        </button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, FORM_FIELD_IMPORTS, TEXTAREA_IMPORTS, ProvideColorDirective],
})
export class NoteFormComponent {
  protected errorTheme = injectSemanticColorTheme('error');
  protected store = injectNoteStore();
  public initial = input('');

  /** Saves into the note being changed instead of writing a new one, and offers Delete. */
  public changing = input(false, { transform: booleanAttribute });

  private field = viewChild.required(TextareaComponent);

  protected text = linkedSignal(() => this.initial());

  constructor() {
    afterNextRender(() => this.field().focus());
  }

  protected submit() {
    if (this.changing()) this.store.save(this.text());
    else this.store.send(this.text());
  }

  protected handleKey(event: KeyboardEvent) {
    const action = draftKeyOf(event);

    if (!action) return;

    event.preventDefault();
    event.stopPropagation();
    if (action === 'send') this.submit();
    else this.store.cancel();
  }
}
