import { Component, ElementRef, computed, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { signalElementDimensions } from '../../element-dimensions';
import { signalElementIntersection } from '../../element-intersection';
import { signalElementMutations } from '../../element-mutations';

const describeIntersection = (entry: { isVisible: boolean; isAbove: boolean; isBelow: boolean } | undefined) => {
  if (!entry) return 'none';
  if (entry.isVisible) return 'visible';
  if (entry.isAbove) return 'above';
  if (entry.isBelow) return 'below';

  return 'hidden';
};

@Component({
  selector: 'et-sb-element-observers',
  template: `
    <div class="flex flex-col gap-8 p-8 font-sans">
      <section class="flex flex-col gap-2">
        <div
          #scroller
          class="overflow-auto rounded-lg border border-white/20"
          data-testid="scroller"
          style="height: 200px; width: 240px"
        >
          <div style="height: 400px"></div>
          <div #target class="p-4" data-testid="target" style="height: 80px">Target</div>
          <div style="height: 400px"></div>
        </div>
        <output data-testid="intersection">{{ intersection() }}</output>
      </section>

      <section class="flex flex-col gap-2">
        <button (click)="wide.set(!wide())" type="button">Toggle width</button>
        <div
          #measured
          [style.width]="wide() ? '80%' : '40%'"
          class="rounded-lg border border-white/20 p-4"
          data-testid="measured"
        >
          Measured
        </div>
        <output data-testid="dimensions">{{ width() }}</output>
      </section>

      <section class="flex flex-col gap-2">
        <div #mutated data-testid="mutated">Mutated</div>
        <output data-testid="mutation">{{ mutation() }}</output>
      </section>
    </div>
  `,
  encapsulation: ViewEncapsulation.None
})
export class ElementObserversStorybookComponent {
  private scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private target = viewChild<ElementRef<HTMLElement>>('target');
  private measured = viewChild<ElementRef<HTMLElement>>('measured');
  private mutated = viewChild<ElementRef<HTMLElement>>('mutated');

  protected wide = signal(false);

  private intersections = signalElementIntersection(this.target, { root: this.scroller, threshold: [0, 0.5, 1] });
  private dimensions = signalElementDimensions(this.measured);
  private mutations = signalElementMutations(this.mutated, { attributes: true, childList: true });

  protected intersection = computed(() => describeIntersection(this.intersections()[0]));
  protected width = computed(() => this.dimensions().offset?.width ?? 'none');
  protected mutation = computed(() => {
    const record = this.mutations();

    if (!record) return 'none';

    return record.type === 'attributes'
      ? `attributes:${record.attributeName}`
      : `childList:${record.addedNodes.length}`;
  });
}
