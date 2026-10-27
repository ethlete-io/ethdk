import { Component, ViewEncapsulation, computed, input, linkedSignal, output } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { ListedProduct } from '../../host/design';
import { ListedFlow } from '../../host/design-flows';
import { Camera, Point } from '../components/design-canvas/canvas-math';
import { FramePoint } from '../components/design-canvas/canvas-pin';
import { DesignCanvasComponent } from '../components/design-canvas/design-canvas.component';
import { commentDraftOf } from './comment-pins';
import { flowFramesOf } from './flow-frames';
import { NoteBodyComponent } from './note-body.component';
import { NoteFormComponent } from './note-form.component';
import { flowNotesOf } from './note-places';
import { injectNoteStore } from './note-store';

@Component({
  selector: 'ethlete-flow-view',
  template: `
    <div class="absolute top-3 right-4 z-1 flex gap-2">
      <div
        class="flex gap-0.5 rounded-[0.6rem] border border-[var(--et-surface-border-solid)] bg-[var(--et-surface-background-solid)] p-0.5"
        role="group"
        aria-label="Preset"
      >
        @for (name of presets(); track name) {
          <button
            [pressed]="name === preset()"
            (click)="preset.set(name)"
            et-button
            type="button"
            variant="transparent"
            color="surface"
            size="xs"
            data-flow-preset
          >
            {{ name }}
          </button>
        }
      </div>
      <ng-content />
    </div>
    <ng-template #noteBody let-note>
      <ethlete-note-body [note]="note" [flow]="flow().name" />
    </ng-template>
    <ethlete-design-canvas
      [frames]="drawn().frames"
      [lines]="drawn().lines"
      [cameraKey]="cameraKey() + ' ' + preset()"
      [restoredCamera]="restoredCamera()"
      [notes]="notes()"
      [noteTemplate]="noteBody"
      [pointing]="noteStore.active()"
      [draft]="noteStore.draft()"
      (cameraChange)="cameraChange.emit($event)"
      (pointPick)="startNote($event)"
      (spacePick)="startFreeNote($event)"
      class="min-h-0"
      arrangement="flow"
      pointingLabel="Note on"
    >
      @if (noteStore.draft()) {
        <ethlete-note-form canvasDraft />
      }
    </ethlete-design-canvas>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, DesignCanvasComponent, NoteBodyComponent, NoteFormComponent],
  host: { class: 'relative grid min-h-0' },
})
export class FlowViewComponent {
  protected noteStore = injectNoteStore();
  public port = input.required<number>();
  public product = input.required<ListedProduct>();
  public flow = input.required<ListedFlow>();
  public epoch = input(0);
  public revision = input(0);
  public surface = input<string | undefined>(undefined);
  public color = input<string | undefined>(undefined);
  public cameraKey = input<string | null>(null);

  public restoredCamera = input<Camera | null>(null);

  public cameraChange = output<Camera | null>();

  protected presets = computed(() => Object.keys(this.product().presets));

  protected preset = linkedSignal<string[], string>({
    source: this.presets,
    computation: (names, previous) => (previous && names.includes(previous.value) ? previous.value : (names[0] ?? '')),
  });

  protected drawn = computed(() =>
    flowFramesOf({
      port: this.port(),
      product: this.product(),
      flow: this.flow(),
      preset: this.preset(),
      epoch: this.epoch(),
      revision: this.revision(),
      surface: this.surface(),
      color: this.color(),
    }),
  );

  protected notes = computed(() => flowNotesOf(this.flow(), this.noteStore.notes()));

  protected startNote(pick: FramePoint) {
    const draft = commentDraftOf(this.drawn().frames, pick);

    if (draft) this.noteStore.start(draft);
  }

  protected startFreeNote(at: Point) {
    this.noteStore.start({ flow: this.flow().name, at });
  }
}
