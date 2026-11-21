import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  input,
  linkedSignal,
  output,
  signal,
  TemplateRef,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  BUTTON_IMPORTS,
  FORM_FIELD_IMPORTS,
  SELECT_IMPORTS,
  TEXTAREA_IMPORTS,
  TextareaComponent,
} from '@ethlete/components';
import { signalElementDimensions } from '@ethlete/core';
import { CanvasDragDirective } from '../../components/design-canvas/canvas-drag.directive';
import { CanvasViewport, mountCanvasViewport } from '../../components/design-canvas/canvas-viewport';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { CanvasViewportComponent } from '../canvas-viewport/canvas-viewport.component';
import { SHELL_SAMPLE, ShellAction, ShellPageComponent, ShellState } from '../shell-main/shell-page.component';
import { TreeRow } from '../tree-row/tree-row-item.component';
import { TreeRowComponent } from '../tree-row/tree-row.component';
import { ZoomChipComponent } from '../zoom-chip/zoom-chip.component';

export const FLOWS_SAMPLE: string[] = [...STUDIO_LABELS.flows.sample.names];

export type FlowsPageFrame = { id: string; title: string; src: string; col: number; row: number };

export type FlowsPageLine = { from: string; to: string; label: string };

export type FlowsPagePreset = { value: string; label: string };

/** A free note at its top left corner on the flow canvas; an empty `text` is a new note still being written. */
export type FlowsPageNote = { id: string; text: string; x: number; y: number };

export type FlowsPageNoteMove = { id: string; x: number; y: number };

export type FlowsPageNoteText = { id: string; text: string };

const frameSrc = (part: string, state: string) =>
  '/frame.html?' + new URLSearchParams({ product: 'studio', part: 'pages/' + part, state }).toString();

export const FLOWS_SAMPLE_FRAMES: FlowsPageFrame[] = [
  { id: 'inbox', title: 'Inbox · open', src: frameSrc('inbox', 'open'), col: 0, row: 0 },
  { id: 'sketch', title: 'Sketches · page-sketch', src: frameSrc('sketches', 'page-sketch'), col: 1, row: 0 },
  { id: 'resolved', title: 'Inbox · with-resolved', src: frameSrc('inbox', 'with-resolved'), col: 1, row: 1 },
  { id: 'system', title: 'System · part', src: frameSrc('system', 'part'), col: 2, row: 0 },
];

export const FLOWS_SAMPLE_LINES: FlowsPageLine[] = [
  { from: 'inbox', to: 'sketch', label: STUDIO_LABELS.flows.sample.lines[0] },
  { from: 'inbox', to: 'resolved', label: STUDIO_LABELS.flows.sample.lines[1] },
  { from: 'sketch', to: 'system', label: STUDIO_LABELS.flows.sample.lines[2] },
];

export const FLOWS_SAMPLE_NOTES: FlowsPageNote[] = [
  { id: 'gap', text: STUDIO_LABELS.flows.sample.notes[0], x: 790, y: 262 },
  { id: 'new', text: '', x: 0, y: 262 },
];

const ZOOM_STEP = 1.5;

const NOTE_INSET = 24;

const stageStart = (viewport: HTMLElement, stage: HTMLElement) => {
  const from = viewport.getBoundingClientRect();
  const to = stage.getBoundingClientRect();

  return { x: Math.round(to.left - from.left), y: Math.round(to.top - from.top) };
};

export const FLOWS_SHOT = { width: 1440, height: 900, scale: 0.18, colGap: 140, rowGap: 56, caption: 20 };

@Component({
  selector: 'ethlete-flows-page',
  template: `
    <ethlete-shell-page [shell]="shell()" (action)="shellAction.emit($event)" section="Flows">
      <div class="-m-space-2 h-[calc(100%+var(--space-2)*2)] overflow-y-auto p-space-2" shellMainSide>
        @if (rows().length) {
          <ethlete-tree-row [rows]="rows()" (rowPress)="pick.emit($event.label)" />
        } @else {
          <p class="m-0 px-space-3 py-space-2 text-ui-sm text-et-surface-muted">{{ LABELS.none }}</p>
        }
      </div>
      @if (flow() === 'open') {
        <div class="relative h-full overflow-hidden">
          <ethlete-canvas-viewport class="absolute inset-0 overflow-hidden">
            <div
              #world
              [style.width.px]="graph().width"
              [style.height.px]="graph().height"
              class="absolute top-0 left-0 origin-top-left"
            >
              <svg
                [attr.width]="graph().width"
                [attr.height]="graph().height"
                class="absolute inset-0 overflow-visible text-et-surface-muted"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="flow-arrow"
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto"
                  >
                    <path d="M1 1 9 5 1 9" fill="none" stroke="currentColor" stroke-width="1.5" />
                  </marker>
                </defs>
                @for (edge of graph().edges; track edge.id) {
                  <path [attr.d]="edge.path" marker-end="url(#flow-arrow)" />
                }
              </svg>
              @for (box of graph().boxes; track box.id) {
                <figure [style.left.px]="box.x" [style.top.px]="box.y" class="absolute m-0 flex flex-col gap-space-1">
                  <span class="text-ui-sm text-et-surface-muted">{{ box.title }}</span>
                  <div class="rounded-sm outline outline-et-surface-border">
                    <div
                      [style.width.px]="graph().w"
                      [style.height.px]="graph().h"
                      class="pointer-events-none overflow-hidden"
                      data-et-projected="shot"
                    >
                      <ng-container
                        [ngTemplateOutlet]="frameTemplate()"
                        [ngTemplateOutletContext]="{ $implicit: box }"
                      />
                    </div>
                  </div>
                </figure>
              }
              @for (edge of graph().edges; track edge.id) {
                <span
                  [style.left.px]="edge.labelX"
                  [style.top.px]="edge.labelY"
                  [style.width.px]="edge.labelWidth"
                  class="absolute -translate-y-full pb-space-1 text-center text-ui-xs text-et-surface-muted"
                >
                  {{ edge.label }}
                </span>
              }
              @for (note of shownNotes(); track note.id) {
                <div
                  [style.left.px]="note.x"
                  [style.top.px]="note.y"
                  [ethleteCanvasDrag]="note"
                  [canvasDragZoom]="zoom()"
                  (canvasDragMove)="dragged.set({ id: note.id, x: $event.x, y: $event.y })"
                  (canvasDragEnd)="noteMove.emit({ id: note.id, x: $event.x, y: $event.y })"
                  (dblclick)="edit(note)"
                  class="absolute box-border w-64 cursor-grab rounded-md border border-et-surface-border bg-et-surface-bg p-space-3 text-ui-md text-et-surface shadow-lg"
                  data-flow-note
                >
                  <div class="flex items-start gap-space-1">
                    @if (editing() !== note.id) {
                      <p class="m-0 flex-1 whitespace-pre-wrap">{{ note.text }}</p>
                    } @else {
                      <div (focusout)="commit(note)" (pointerdown)="$event.stopPropagation()" class="flex-1">
                        <et-form-field>
                          <et-textarea
                            [(value)]="written"
                            [aria-label]="LABELS.note"
                            [placeholder]="LABELS.notePlaceholder"
                            (keydown)="handleNoteKey($event, note)"
                            rows="3"
                          />
                        </et-form-field>
                      </div>
                    }
                    <button
                      [attr.aria-label]="LABELS.deleteNote"
                      (pointerdown)="$event.stopPropagation()"
                      (click)="noteDelete.emit(note.id)"
                      et-icon-button
                      type="button"
                      variant="transparent"
                      color="surface"
                      size="xs"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.3"
                        stroke-linecap="round"
                        aria-hidden="true"
                        etIcon
                      >
                        <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>
              }
            </div>
          </ethlete-canvas-viewport>
          <div
            class="pointer-events-none relative box-border flex h-full flex-col gap-space-4 p-space-5 ps-[calc(var(--st-shell-inset-left)+var(--space-5))]"
          >
            <header class="flex h-(--control-md) flex-none items-center gap-space-3 *:pointer-events-auto">
              <span class="text-ui-lg font-ui-strong">{{ selected() }}</span>
              <span class="flex-1"></span>
              <button (click)="requestNote()" et-button type="button" variant="outline" color="surface" size="sm">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                  etIcon
                >
                  <path d="M10.5 3 13 5.5 6 12.5H3.5V10z" />
                  <path d="m9 4.5 2.5 2.5" />
                </svg>
                {{ LABELS.addNote }}
              </button>
              <div class="w-60">
                <et-form-field size="sm">
                  <et-select [value]="preset()" [aria-label]="LABELS.presetAria" (valueChange)="pickPreset($event)">
                    @for (option of presetOptions(); track option.value) {
                      <et-select-option [value]="option.value" [label]="option.label">{{
                        option.label
                      }}</et-select-option>
                    }
                  </et-select>
                </et-form-field>
              </div>
            </header>
            <div #stage class="min-h-0 flex-1"></div>
          </div>
          <div
            #shellInsetProbe
            class="pointer-events-none invisible absolute top-0 left-0 h-0 w-(--st-shell-inset-left,0px)"
            aria-hidden="true"
          ></div>
          <ethlete-zoom-chip
            [percent]="percent()"
            (zoomOut)="zoomBy(1 / ZOOM_STEP)"
            (zoomIn)="zoomBy(ZOOM_STEP)"
            (zoomReset)="zoomReset()"
            (fit)="fit()"
            class="absolute right-space-3 bottom-space-3 z-3"
          />
        </div>
      } @else {
        <div class="flex h-full items-center justify-center ps-(--st-shell-inset-left)">
          <div class="flex w-2xl flex-col items-center gap-space-4 text-center text-ui-sm">
            <div class="flex items-center gap-space-2" aria-hidden="true">
              <span class="block h-15 w-24 rounded-sm bg-et-surface-bg outline outline-et-surface-border"></span>
              <span class="block h-px w-10 bg-et-surface-border"></span>
              <span class="block h-15 w-24 rounded-sm bg-et-surface-bg outline outline-et-surface-border"></span>
              <span class="block h-px w-10 bg-et-surface-border"></span>
              <span class="block h-15 w-24 rounded-sm bg-et-surface-bg outline outline-et-surface-border"></span>
            </div>
            <p class="m-0 text-ui-md font-ui-strong text-et-surface">{{ LABELS.emptyTitle }}</p>
            <p class="m-0 text-et-surface-muted">{{ LABELS.emptyExplainer }}</p>
            <p class="m-0 rounded-(--radius-control-md) bg-et-surface-bg p-space-3 text-ui-sm text-et-surface">
              {{ LABELS.emptyPrompt }}
            </p>
            <button (click)="copyPrompt.emit()" et-button type="button" variant="outline" size="sm">
              {{ LABELS.copyPrompt }}
            </button>
          </div>
        </div>
      }
    </ethlete-shell-page>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [
    NgTemplateOutlet,
    BUTTON_IMPORTS,
    CanvasDragDirective,
    CanvasViewportComponent,
    FORM_FIELD_IMPORTS,
    SELECT_IMPORTS,
    TEXTAREA_IMPORTS,
    ShellPageComponent,
    TreeRowComponent,
    ZoomChipComponent,
  ],
  host: { class: 'block h-screen w-full' },
})
export class FlowsPageComponent {
  public shell = input<ShellState>(SHELL_SAMPLE);
  public frameTemplate = input<TemplateRef<{ $implicit: FlowsPageFrame }> | null>(null);
  public flow = input<'open' | 'none'>('open');
  public flows = input(FLOWS_SAMPLE);
  public selected = input(FLOWS_SAMPLE[0]);
  public frames = input(FLOWS_SAMPLE_FRAMES);
  public lines = input(FLOWS_SAMPLE_LINES);
  public preset = input<string>(STUDIO_LABELS.flows.sample.preset);
  public presets = input<FlowsPagePreset[]>([]);
  public ratio = input(FLOWS_SHOT.height / FLOWS_SHOT.width);
  public notes = input<FlowsPageNote[]>([]);
  public shellAction = output<ShellAction>();

  public addNote = output<{ x: number; y: number }>();
  public noteMove = output<FlowsPageNoteMove>();
  public noteText = output<FlowsPageNoteText>();
  public noteDelete = output<string>();

  public pick = output<string>();
  public copyPrompt = output();
  public presetChange = output<string>();

  private noteField = viewChild(TextareaComponent);
  private viewport = viewChild(CanvasViewportComponent, { read: ElementRef });
  private world = viewChild<ElementRef<HTMLElement>>('world');

  private shellInsetProbe = viewChild<ElementRef<HTMLElement>>('shellInsetProbe');
  private stage = viewChild<ElementRef<HTMLElement>>('stage');
  private shellInset = signalElementDimensions(this.shellInsetProbe);
  private covered = computed(() => this.shellInset().offset?.width ?? 0);
  private pickedFlow: string | null = null;
  protected readonly LABELS = STUDIO_LABELS.flows;
  protected readonly ZOOM_STEP = ZOOM_STEP;
  private canvas = signal<CanvasViewport | null>(null);
  private mounted: HTMLElement | null = null;

  private shownSource = computed(() => this.notes());
  protected zoom = computed(() => this.canvas()?.zoom() ?? 1);
  protected editing = linkedSignal<FlowsPageNote[], string | null>({
    source: this.shownSource,
    computation: (notes, previous) =>
      notes.find((note) => !note.text)?.id ??
      (previous?.value && notes.some((note) => note.id === previous.value) ? previous.value : null),
  });
  protected written = signal('');
  protected dragged = linkedSignal<FlowsPageNote[], FlowsPageNoteMove | null>({
    source: this.shownSource,
    computation: () => null,
  });

  protected shownNotes = computed(() => {
    const dragged = this.dragged();

    return this.notes().map((note) => (dragged?.id === note.id ? { ...note, x: dragged.x, y: dragged.y } : note));
  });

  protected percent = computed(() => Math.round((this.canvas()?.zoom() ?? 1) * 100));
  protected presetOptions = computed(() =>
    this.presets().length ? this.presets() : [{ value: this.preset(), label: this.preset() }],
  );

  protected graph = computed(() => {
    const { width, scale, colGap, rowGap, caption } = FLOWS_SHOT;
    const w = width * scale;
    const h = w * this.ratio();
    const frames = this.frames();
    const at = (frame: FlowsPageFrame) => ({
      x: frame.col * (w + colGap),
      y: frame.row * (h + caption + rowGap),
    });
    const cols = Math.max(0, ...frames.map((frame) => frame.col)) + 1;
    const rows = Math.max(0, ...frames.map((frame) => frame.row)) + 1;

    const edges = this.lines().flatMap((line) => {
      const from = frames.find((frame) => frame.id === line.from);
      const to = frames.find((frame) => frame.id === line.to);

      if (!from || !to) return [];

      const a = at(from);
      const b = at(to);
      const x1 = a.x + w + 4;
      const y1 = a.y + caption + h / 2;
      const x2 = b.x - 4;
      const y2 = b.y + caption + h / 2;
      const bend = x1 + 12;

      return [
        {
          id: `${line.from} ${line.to}`,
          label: line.label,
          path: y1 === y2 ? `M${x1} ${y1}H${x2}` : `M${x1} ${y1}H${bend}V${y2}H${x2}`,
          labelX: bend + 4,
          labelY: y2,
          labelWidth: x2 - bend - 8,
        },
      ];
    });

    return {
      w,
      h,
      width: cols * w + (cols - 1) * colGap,
      height: rows * (h + caption) + (rows - 1) * rowGap,
      boxes: frames.map((frame) => ({
        ...frame,
        ...at(frame),
      })),
      edges,
    };
  });

  protected rows = computed<TreeRow[]>(() =>
    this.flow() === 'none'
      ? []
      : this.flows().map((label) => ({ label, depth: 0, kind: 'leaf', selected: label === this.selected() })),
  );

  public constructor() {
    afterRenderEffect(() => this.mountCamera());
    afterRenderEffect(() => {
      this.covered();
      untracked(() => this.canvas())?.refresh();
    });
    afterRenderEffect(() => this.resetOnPick());
    afterRenderEffect(() => this.focusEditedNote());
  }

  public zoomBy(factor: number) {
    const canvas = this.canvas();

    canvas?.show({ kind: 'visible', zoom: canvas.camera().zoom * factor });
  }

  protected zoomReset() {
    this.canvas()?.show({ kind: 'visible', zoom: 1 });
  }

  protected fit() {
    this.canvas()?.show({ kind: 'all' });
  }

  protected requestNote() {
    const canvas = this.canvas();
    const viewport = this.viewport()?.nativeElement;
    const stage = this.stage()?.nativeElement;

    if (!canvas || !viewport || !stage) return;

    const { x, y, zoom } = canvas.camera();
    const from = viewport.getBoundingClientRect();
    const to = stage.getBoundingClientRect();

    this.addNote.emit({
      x: Math.round((to.left - from.left + NOTE_INSET - x) / zoom),
      y: Math.round((to.top - from.top + NOTE_INSET - y) / zoom),
    });
  }

  protected edit(note: FlowsPageNote) {
    this.written.set(note.text);
    this.editing.set(note.id);
  }

  protected handleNoteKey(event: KeyboardEvent, note: FlowsPageNote) {
    event.stopPropagation();

    if (event.key === 'Escape') {
      this.editing.set(null);
      this.written.set('');
      if (!note.text) this.noteDelete.emit(note.id);
    } else if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.commit(note);
    }
  }

  protected commit(note: FlowsPageNote) {
    if (this.editing() !== note.id) return;

    const text = this.written().trim();

    this.editing.set(null);
    this.written.set('');

    if (!text) {
      if (!note.text) this.noteDelete.emit(note.id);
    } else if (text !== note.text) {
      this.noteText.emit({ id: note.id, text });
    }
  }

  protected pickPreset(value: unknown) {
    if (typeof value === 'string') this.presetChange.emit(value);
  }

  private focusEditedNote() {
    if (this.editing() === null) return;

    this.noteField()?.focus();
  }

  private resetOnPick() {
    const selected = this.selected();
    const viewport = this.viewport()?.nativeElement;
    const stage = this.stage()?.nativeElement;
    const previous = this.pickedFlow;
    const canvas = untracked(() => this.canvas());

    this.pickedFlow = selected ?? null;

    if (previous === null || previous === selected || !canvas || !stage || !viewport) return;

    canvas.reset({ ...stageStart(viewport, stage), zoom: 1 });
  }

  private mountCamera() {
    const viewport: HTMLElement | undefined = this.viewport()?.nativeElement;
    const world = this.world()?.nativeElement;
    const stage = this.stage()?.nativeElement;

    if (!viewport || !world || !stage || viewport === this.mounted) return;

    this.mounted = viewport;
    this.canvas.set(
      mountCanvasViewport({
        viewport,
        world,
        frameSelector: 'figure',
        padding: 24,
        covered: () => this.covered(),
        start: { ...stageStart(viewport, stage), zoom: 1 },
      }),
    );
  }
}
