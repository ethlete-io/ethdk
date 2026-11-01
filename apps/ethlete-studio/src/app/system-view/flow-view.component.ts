import { Component, DestroyRef, ViewEncapsulation, computed, inject, input, linkedSignal, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { catchError, from, of } from 'rxjs';
import { ListedProduct, ListedSketch } from '../../host/design';
import { ListedFlow } from '../../host/design-flows';
import { flowColumnsOf } from '../components/design-canvas/flow-layout';
import {
  FLOWS_SHOT,
  FlowsPageComponent,
  FlowsPageFrame,
  FlowsPageLine,
  FlowsPagePreset,
} from '../design-parts/flows-page/flows-page.component';
import { STUDIO_LABELS } from '../i18n/studio-labels';
import { rememberFlowPreset, rememberedView } from '../studio-view/remembered';
import { flowFramesOf, flowKeyOf } from './flow-frames';
import { PageShell, PageShellAction } from './page-shell';

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
      [frameTemplate]="frame"
      [product]="shell().product"
      [products]="shell().products"
      [project]="shell().project"
      [projects]="shell().projects"
      [panel]="shell().panel"
      (pick)="shellAction.emit({ kind: 'pick', key: flowKey($event) })"
      (presetChange)="pickPreset($event)"
      (copyPrompt)="copyPrompt()"
      (collapse)="shellAction.emit({ kind: 'collapse' })"
      (sectionChange)="shellAction.emit({ kind: 'section', section: $event })"
      (productChange)="shellAction.emit({ kind: 'product', name: $event })"
      (allProducts)="shellAction.emit({ kind: 'allProducts' })"
      (projectChange)="shellAction.emit({ kind: 'project', name: $event })"
      (openProject)="shellAction.emit({ kind: 'openProject' })"
      class="h-full!"
    />

    <ng-template #frame let-box>
      @if (sources().get(box.id); as shown) {
        <iframe
          [src]="shown.src"
          [title]="box.title"
          [style.width.px]="shown.width"
          [style.height.px]="shown.height"
          [style.transform]="'scale(' + shown.scale + ')'"
          class="block origin-top-left border-0 scheme-normal"
          tabindex="-1"
        ></iframe>
      }
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FlowsPageComponent],
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
  public view = input(0);
  public surface = input<string | undefined>(undefined);
  public color = input<string | undefined>(undefined);
  public shell = input.required<PageShell>();

  public shellAction = output<PageShellAction>();

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
          view: this.view(),
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

  protected sources = computed(() => {
    const boxWidth = FLOWS_SHOT.width * FLOWS_SHOT.scale;
    const boxHeight = FLOWS_SHOT.height * FLOWS_SHOT.scale;

    return new Map(
      this.source().frames.map((frame) => {
        const width = frame.width ?? FLOWS_SHOT.width;
        const scale = boxWidth / width;

        return [
          frame.id,
          {
            src: this.sanitizer.bypassSecurityTrustResourceUrl(frame.src),
            width,
            height: frame.height ?? boxHeight / scale,
            scale,
          },
        ] as const;
      }),
    );
  });

  protected pickPreset(name: string) {
    const key = this.presetKey();

    this.preset.set(name);
    if (key !== null) rememberFlowPreset(key, name);
  }

  protected copyPrompt() {
    from(navigator.clipboard.writeText(STUDIO_LABELS.flows.emptyPrompt))
      .pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
