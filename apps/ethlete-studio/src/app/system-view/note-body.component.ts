import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { CanvasNote, noteKeyOf } from '../components/design-canvas/canvas-note';
import { NoteFormComponent } from './note-form.component';
import { injectNoteStore } from './note-store';

/** A note's text, which opens the note for a change on a click; a heading is a free note of `flow`. */
@Component({
  selector: 'ethlete-note-body',
  template: `
    @if (changing()) {
      <ethlete-note-form [initial]="note().text" changing />
    } @else {
      <p
        [textContent]="note().text"
        [attr.aria-label]="'Change note: ' + note().text"
        (click)="change($event)"
        (keydown.enter)="change($event)"
        class="m-0 cursor-text whitespace-pre-wrap"
        role="button"
        tabindex="0"
      ></p>
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NoteFormComponent],
})
export class NoteBodyComponent {
  private store = injectNoteStore();

  public note = input.required<CanvasNote>();

  public flow = input<string | null>(null);

  protected changing = computed(() => this.store.editing()?.key === noteKeyOf(this.note()));

  protected change(event: Event) {
    event.stopPropagation();

    const note = this.note();

    this.store.edit({ id: note.id, key: noteKeyOf(note), flow: note.heading ? this.flow() : null });
  }
}
