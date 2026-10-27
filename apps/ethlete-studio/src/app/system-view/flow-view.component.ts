import { Component, ViewEncapsulation, computed, input, linkedSignal, output } from '@angular/core';
import { BUTTON_IMPORTS } from '@ethlete/components';
import { ListedProduct } from '../../host/design';
import { ListedFlow } from '../../host/design-flows';
import { Camera } from '../components/design-canvas/canvas-math';
import { DesignCanvasComponent } from '../components/design-canvas/design-canvas.component';
import { flowFramesOf } from './flow-frames';

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
    <ethlete-design-canvas
      [frames]="drawn().frames"
      [lines]="drawn().lines"
      [cameraKey]="cameraKey() + ' ' + preset()"
      [restoredCamera]="restoredCamera()"
      (cameraChange)="cameraChange.emit($event)"
      class="min-h-0"
      arrangement="flow"
    />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [BUTTON_IMPORTS, DesignCanvasComponent],
  host: { class: 'relative grid min-h-0' },
})
export class FlowViewComponent {
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
}
