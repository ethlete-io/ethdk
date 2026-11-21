import { Component, DestroyRef, ViewEncapsulation, computed, inject, input, linkedSignal, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { EMPTY, Observable, catchError, from, of, tap } from 'rxjs';
import { ListedProduct, ListedSketch } from '../../host/design';
import { ListedFlow } from '../../host/design-flows';
import { FlowAddress, addFlowNote$, changeFlowNote$, deleteFlowNote$ } from '../../host/design-notes';
import { flowColumnsOf } from '../components/design-canvas/flow-layout';
import {
  FLOWS_SHOT,
  FlowsPageComponent,
  FlowsPageFrame,
  FlowsPageLine,
  FlowsPageNote,
  FlowsPageNoteMove,
  FlowsPageNoteText,
  FlowsPagePreset,
} from '../design-parts/flows-page/flows-page.component';
import { STUDIO_LABELS } from '../i18n/studio-labels';
import { rememberFlowPreset, rememberedView } from '../studio-view/remembered';
import { flowFramesOf, flowKeyOf, frameRatioOf } from './flow-frames';
import { FrameShieldComponent } from '../components/design-canvas/partials/frame-shield.component';
import { PageShell, PageShellAction } from './page-shell';

const NEW_NOTE = 'new';

const UNPLACED_NOTE = { x: -320, step: 140 };

@Component({
  selector: 'ethlete-flow-view',
  template: `
    <ethlete-flows-page
      [flow]="flow() ? 'open' : 'none'"
      [flows]="flowNames()"
      [selected]="flow()?.name ?? ''"
      [frames]="drawn().frames"
      [lines]="drawn().lines"
      [preset]="preset()"
      [presets]="presets()"
      [ratio]="ratio()"
      [notes]="notes()"
      [frameTemplate]="frame"
      [shell]="shell()"
      (pick)="shellAction.emit({ kind: 'pick', key: flowKey($event) })"
      (presetChange)="pickPreset($event)"
      (copyPrompt)="copyPrompt()"
      (addNote)="draft.set({ id: NEW_NOTE, text: '', x: $event.x, y: $event.y })"
      (noteText)="writeText($event)"
      (noteMove)="move($event)"
      (noteDelete)="remove($event)"
      (shellAction)="shellAction.emit($event)"
      class="h-full!"
    />

    <ng-template #frame let-box>
      @if (sources().get(box.id); as shown) {
        <div class="relative size-full">
          <iframe
            [src]="shown.src"
            [title]="box.title"
            [style.width.px]="shown.width"
            [style.height.px]="shown.height"
            [style.transform]="'scale(' + shown.scale + ')'"
            class="block origin-top-left border-0 scheme-normal"
            tabindex="-1"
          ></iframe>
          <ethlete-frame-shield class="pointer-events-auto" />
        </div>
      }
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FlowsPageComponent, FrameShieldComponent],
  host: { class: 'block size-full' },
})
export class FlowViewComponent {
  private destroyRef = inject(DestroyRef);
  private sanitizer = inject(DomSanitizer);

  public port = input.required<number>();
  public product = input.required<ListedProduct>();
  public flows = input.required<ListedFlow[]>();
  public flow = input<ListedFlow | null>(null);
  public sketches = input<ListedSketch[]>([]);
  public epoch = input(0);
  public revision = input(0);
  public surface = input<string | undefined>(undefined);
  public color = input<string | undefined>(undefined);
  public shell = input.required<PageShell>();
  public shellAction = output<PageShellAction>();

  private safeUrls = new Map<string, SafeResourceUrl>();

  protected readonly NEW_NOTE = NEW_NOTE;

  private flowName = computed(() => this.flow()?.name ?? null);

  protected draft = linkedSignal<string | null, FlowsPageNote | null>({
    source: this.flowName,
    computation: () => null,
  });

  protected notes = computed<FlowsPageNote[]>(() => {
    const draft = this.draft();
    const placed = (this.flow()?.notes ?? []).map((note, index) => ({
      id: note.id,
      text: note.text,
      ...(note.at ?? { x: UNPLACED_NOTE.x, y: index * UNPLACED_NOTE.step }),
    }));

    return draft ? [...placed, draft] : placed;
  });

  protected flowNames = computed(() => this.flows().map((listed) => listed.name));

  protected flowKey = flowKeyOf;

  private presetKey = computed(() => {
    const flow = this.flow();

    return flow ? `${this.product().name} ${flowKeyOf(flow.name)}` : null;
  });

  private presetNames = computed(() => Object.keys(this.product().presets));

  protected presets = computed<FlowsPagePreset[]>(() =>
    Object.entries(this.product().presets).map(([name, size]) => ({
      value: name,
      label: STUDIO_LABELS.flows.presetLabel(name, size),
    })),
  );

  protected preset = linkedSignal<{ names: string[]; key: string | null }, string>({
    source: () => ({ names: this.presetNames(), key: this.presetKey() }),
    computation: ({ names, key }, previous) => {
      const remembered = key === null ? undefined : rememberedView().flowPresets?.[key];

      if (remembered !== undefined && names.includes(remembered)) return remembered;

      return previous && names.includes(previous.value) ? previous.value : (names[0] ?? '');
    },
  });

  private source = computed(() => {
    const flow = this.flow();

    return flow
      ? flowFramesOf({
          port: this.port(),
          product: this.product(),
          flow,
          preset: this.preset(),
          sketches: this.sketches(),
          epoch: this.epoch(),
          revision: this.revision(),
          surface: this.surface(),
          color: this.color(),
        })
      : { frames: [], lines: [] };
  });

  protected drawn = computed<{ frames: FlowsPageFrame[]; lines: FlowsPageLine[] }>(() => {
    const { frames, lines } = this.source();
    const columns = flowColumnsOf(
      frames.map((frame) => frame.id),
      lines,
    );
    const rowsTaken = new Map<number, number>();

    return {
      frames: frames.map((frame) => {
        const col = columns.get(frame.id) ?? 0;
        const row = rowsTaken.get(col) ?? 0;

        rowsTaken.set(col, row + 1);

        return { id: frame.id, title: frame.label, src: frame.src, col, row };
      }),
      lines: lines.map((line) => ({ from: line.from, to: line.to, label: line.label ?? '' })),
    };
  });

  protected ratio = computed(() =>
    frameRatioOf(this.product().presets[this.preset()], FLOWS_SHOT.height / FLOWS_SHOT.width),
  );

  protected sources = computed(() => {
    const boxWidth = FLOWS_SHOT.width * FLOWS_SHOT.scale;
    const boxHeight = boxWidth * this.ratio();

    return new Map(
      this.source().frames.map((frame) => {
        const width = frame.width ?? FLOWS_SHOT.width;
        const scale = boxWidth / width;

        return [
          frame.id,
          {
            src: this.safeUrlOf(frame.src),
            width,
            height: frame.height ?? boxHeight / scale,
            scale,
          },
        ] as const;
      }),
    );
  });

  protected writeText({ id, text }: FlowsPageNoteText) {
    const draft = this.draft();

    if (id !== NEW_NOTE || !draft) {
      this.write((address) => changeFlowNote$(address, { id, text }));

      return;
    }

    this.draft.set({ ...draft, text });
    this.write(
      (address) => addFlowNote$(address, { text, at: { x: draft.x, y: draft.y } }),
      () => this.draft.set(null),
    );
  }

  protected move({ id, x, y }: FlowsPageNoteMove) {
    const draft = this.draft();

    if (id === NEW_NOTE && draft) this.draft.set({ ...draft, x, y });
    else this.write((address) => changeFlowNote$(address, { id, at: { x, y } }));
  }

  protected remove(id: string) {
    if (id === NEW_NOTE) this.draft.set(null);
    else this.write((address) => deleteFlowNote$(address, id));
  }

  protected pickPreset(name: string) {
    const key = this.presetKey();

    this.preset.set(name);
    if (key !== null) rememberFlowPreset(key, name);
  }

  protected copyPrompt() {
    from(navigator.clipboard.writeText(STUDIO_LABELS.flows.emptyPrompt))
      .pipe(
        // eslint-disable-next-line ethlete/no-silent-catch-error -- not surfaced yet, finding 145
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private write<T>(request: (address: FlowAddress) => Observable<T>, done?: () => void) {
    const flow = this.flow();

    if (!flow) return;

    request({ port: this.port(), product: this.product().name, flow: flow.name })
      .pipe(
        tap(() => done?.()),
        // eslint-disable-next-line ethlete/no-silent-catch-error -- designAnswer$ logs the refusal; not surfaced yet, finding 145
        catchError(() => EMPTY),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private safeUrlOf(src: string) {
    let safe = this.safeUrls.get(src);

    if (!safe) {
      safe = this.sanitizer.bypassSecurityTrustResourceUrl(src);
      this.safeUrls.set(src, safe);
    }

    return safe;
  }
}
