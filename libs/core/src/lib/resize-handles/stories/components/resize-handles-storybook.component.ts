import {
  Component,
  DOCUMENT,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { ResizeEdge, ResizeHandlesComponent, ResizeMoveEvent } from '../../resize-handles.component';

type Size = { width: number; height: number };

const INITIAL_SIZE: Size = { width: 200, height: 120 };

@Component({
  selector: 'et-sb-resize-handles',
  template: `
    <div class="flex flex-col gap-4 p-8 font-sans">
      <div class="flex gap-4">
        <button [disabled]="poppedOut()" (click)="popOut()" type="button">Pop out</button>
        <output data-testid="popout-state">{{ poppedOut() ? 'popped-out' : 'docked' }}</output>
      </div>

      <div
        #box
        [style.width.px]="size().width"
        [style.height.px]="size().height"
        class="relative rounded-lg border border-white/20"
        data-testid="box"
      >
        <output class="block p-4" data-testid="size">{{ size().width }}x{{ size().height }}</output>
        <et-resize-handles
          [edges]="edges"
          (resizeStarted)="start($event)"
          (resizeMoved)="move($event)"
          (resizeCancelled)="cancel()"
        />
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ResizeHandlesComponent],
})
export class ResizeHandlesStorybookComponent {
  private document = inject(DOCUMENT);
  private destroyRef = inject(DestroyRef);
  private box = viewChild.required<ElementRef<HTMLElement>>('box');

  protected edges: ResizeEdge[] = ['e', 's', 'se'];
  protected size = signal(INITIAL_SIZE);
  protected poppedOut = signal(false);

  private startSize = INITIAL_SIZE;

  protected start(_edge: ResizeEdge) {
    this.startSize = this.size();
  }

  protected move(event: ResizeMoveEvent) {
    this.size.set({
      width: event.edge === 's' ? this.startSize.width : Math.max(80, this.startSize.width + event.dx),
      height: event.edge === 'e' ? this.startSize.height : Math.max(60, this.startSize.height + event.dy),
    });
  }

  protected cancel() {
    this.size.set(this.startSize);
  }

  protected popOut() {
    const popup = this.document.defaultView?.open('', 'et-sb-resize-handles', 'popup=yes,width=640,height=480');

    if (!popup) return;

    this.document.head
      .querySelectorAll('style, link[rel="stylesheet"]')
      .forEach((node) => popup.document.head.appendChild(node.cloneNode(true)));
    popup.document.body.appendChild(this.box().nativeElement);
    this.poppedOut.set(true);
    this.destroyRef.onDestroy(() => popup.close());
  }
}
