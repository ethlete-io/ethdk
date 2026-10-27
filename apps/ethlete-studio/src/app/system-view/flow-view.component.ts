import { Component, ViewEncapsulation, computed, input, linkedSignal, output, viewChild } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { ListedProduct } from '../../host/design';
import { ListedFlow } from '../../host/design-flows';
import { Camera, Point } from '../components/design-canvas/canvas-math';
import { FramePoint } from '../components/design-canvas/canvas-pin';
import { DesignCanvasComponent } from '../components/design-canvas/design-canvas.component';
import { rememberFlowPreset, rememberedView } from '../studio-view/remembered';
import { CommentDraftComponent } from './comment-draft.component';
import { NumberedComment, commentDraftOf, pinsOf, withOtherSizeNotes } from './comment-pins';
import { injectCommentStore } from './comment-store';
import { CommentThreadComponent } from './comment-thread.component';
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
        class="flex gap-0.5 rounded-[0.6rem] border border-surface-border bg-surface p-0.5"
        role="group"
        aria-label="Preset"
      >
        @for (name of presets(); track name) {
          <button
            [pressed]="name === preset()"
            (click)="pickPreset(name)"
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
    <ng-template #pinThread let-pin>
      <ethlete-comment-thread [commentId]="pin.id" />
    </ng-template>
    <ng-template #noteBody let-note>
      <ethlete-note-body [note]="note" [flow]="flow().name" />
    </ng-template>
    <ethlete-design-canvas
      [frames]="notedFrames()"
      [lines]="drawn().lines"
      [cameraKey]="cameraKey() + ' ' + preset()"
      [restoredCamera]="restoredCamera()"
      [notes]="notesShown() ? notes() : []"
      [noteTemplate]="noteBody"
      [pins]="pins()"
      [pinPopover]="pinThread"
      [pointing]="noteStore.active() || commentStore.active()"
      [pointingLabel]="noteStore.active() ? 'Note on' : 'Comment on'"
      [draft]="noteStore.draft() ?? commentStore.draft()"
      (cameraChange)="cameraChange.emit($event)"
      (pointPick)="pick($event)"
      (spacePick)="startFreeNote($event)"
      class="min-h-0"
      arrangement="flow"
    >
      @if (noteStore.draft()) {
        <ethlete-note-form canvasDraft />
      } @else if (commentStore.draft()) {
        <ethlete-comment-draft canvasDraft />
      }
    </ethlete-design-canvas>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    BUTTON_IMPORTS,
    CommentDraftComponent,
    CommentThreadComponent,
    DesignCanvasComponent,
    NoteBodyComponent,
    NoteFormComponent,
  ],
  host: { class: 'relative grid min-h-0' },
})
export class FlowViewComponent {
  protected noteStore = injectNoteStore();
  protected commentStore = injectCommentStore();
  public port = input.required<number>();
  public product = input.required<ListedProduct>();
  public flow = input.required<ListedFlow>();
  public epoch = input(0);
  public revision = input(0);
  public surface = input<string | undefined>(undefined);
  public color = input<string | undefined>(undefined);
  public cameraKey = input<string | null>(null);
  public notesShown = input(true);
  public restoredCamera = input<Camera | null>(null);

  public cameraChange = output<Camera | null>();

  private canvas = viewChild.required(DesignCanvasComponent);

  protected presets = computed(() => Object.keys(this.product().presets));

  protected preset = linkedSignal<{ names: string[]; key: string | null }, string>({
    source: () => ({ names: this.presets(), key: this.cameraKey() }),
    computation: ({ names, key }, previous) => {
      const remembered = key === null ? undefined : rememberedView().flowPresets?.[key];

      if (remembered !== undefined && names.includes(remembered)) return remembered;

      return previous && names.includes(previous.value) ? previous.value : (names[0] ?? '');
    },
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

  protected notedFrames = computed(() =>
    withOtherSizeNotes(this.drawn().frames, {
      comments: this.commentStore.comments(),
      notes: this.notesShown() ? this.noteStore.notes() : [],
      everyInteraction: true,
    }),
  );

  protected notes = computed(() => flowNotesOf(this.flow(), { notes: this.noteStore.notes(), preset: this.preset() }));

  protected pins = computed(() => pinsOf(this.drawn().frames, this.commentStore.comments()));

  protected pickPreset(name: string) {
    const key = this.cameraKey();

    this.preset.set(name);
    if (key !== null) rememberFlowPreset(key, name);
  }

  protected pick(pick: FramePoint) {
    const draft = commentDraftOf(this.drawn().frames, pick);

    if (!draft) return;
    if (this.noteStore.active()) this.noteStore.start(draft);
    else this.commentStore.start(draft);
  }

  protected startFreeNote(at: Point) {
    if (this.noteStore.active()) this.noteStore.start({ flow: this.flow().name, at });
  }

  /** Opens the pin of a comment on a frame of the flow; `false` when the flow shows no pin for it. */
  public jumpTo(comment: NumberedComment) {
    if (!this.pins().some((pin) => pin.id === comment.id)) return false;

    this.canvas().openPin(comment.id);

    return true;
  }
}
