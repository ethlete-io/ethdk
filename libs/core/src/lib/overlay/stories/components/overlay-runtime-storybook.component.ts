import { Component, ElementRef, ViewEncapsulation, input, inputBinding, viewChild } from '@angular/core';
import { AnimatedLifecycleDirective } from '../../../animations';
import { anchoredOverlayPosition } from '../../overlay-position-anchored';
import { injectOverlayRuntime } from '../../overlay-runtime';
import { OverlayRuntimeRef } from '../../overlay-runtime-ref';

type ClosableOverlay = { ref: OverlayRuntimeRef | null };

const attachRef = <T extends ClosableOverlay>(ref: OverlayRuntimeRef<T>) => {
  const instance = ref.componentInstance();

  if (instance) instance.ref = ref;
};

const STYLES = `
  .et-sb-runtime-pane {
    opacity: 0;
    transition: opacity 150ms linear;
    border-radius: 1.2rem;
    padding: 2.4rem;
    background: var(--et-surface-background-solid, #1d1d20);
    color: var(--et-surface-color-solid, #fff);
    box-shadow: 0 0.8rem 3.2rem rgb(0 0 0 / 0.4);
  }

  .et-sb-runtime-pane.et-animation-enter-to,
  .et-sb-runtime-pane.et-animation-enter-done,
  .et-sb-runtime-pane.et-animation-leave-from {
    opacity: 1;
  }

  .et-overlay-runtime-backdrop {
    background: rgb(0 0 0 / 0.4);
  }
`;

@Component({
  selector: 'et-sb-runtime-dialog',
  template: `
    <div class="flex flex-col gap-4">
      <h2 class="text-h5">{{ heading() }}</h2>
      <input class="rounded-md border border-white/20 bg-transparent px-2 py-1" aria-label="Name" type="text" />
      @if (canStack()) {
        <button (click)="openStacked()" type="button">Open stacked dialog</button>
      }
      <button (click)="ref?.close()" type="button">Close</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [AnimatedLifecycleDirective],
  host: { class: 'et-sb-runtime-pane' },
  styles: STYLES,
})
class OverlayRuntimeStorybookDialogComponent {
  private runtime = injectOverlayRuntime();

  heading = input('Dialog');
  canStack = input(false);
  ref: OverlayRuntimeRef | null = null;

  openStacked() {
    const ref = this.runtime.mount({
      id: 'et-sb-runtime-stacked',
      component: OverlayRuntimeStorybookDialogComponent,
      role: 'dialog',
      ariaLabel: 'Stacked dialog',
      bindings: [inputBinding('heading', () => 'Stacked dialog')],
    });

    attachRef(ref);
  }
}

@Component({
  selector: 'et-sb-runtime-popover',
  template: `
    <p class="text-small">An anchored popover kept inside the viewport padding.</p>
    <button (click)="ref?.close()" type="button">Dismiss</button>
  `,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [AnimatedLifecycleDirective],
  host: { class: 'et-sb-runtime-pane', style: 'display: block; width: 28rem' },
  styles: STYLES,
})
class OverlayRuntimeStorybookPopoverComponent {
  ref: OverlayRuntimeRef | null = null;
}

@Component({
  selector: 'et-sb-overlay-runtime',
  template: `
    <div class="flex flex-col gap-4 p-8 font-sans">
      <button (click)="openModal()" type="button">Open modal</button>
      <button type="button">After the trigger</button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class OverlayRuntimeStorybookComponent {
  private runtime = injectOverlayRuntime();

  openModal() {
    const ref = this.runtime.mount({
      id: 'et-sb-runtime-modal',
      component: OverlayRuntimeStorybookDialogComponent,
      role: 'dialog',
      ariaLabel: 'Modal dialog',
      autoFocus: false,
      bindings: [inputBinding('canStack', () => true)],
    });

    attachRef(ref);
  }
}

@Component({
  selector: 'et-sb-overlay-runtime-popover',
  template: `
    <div class="relative font-sans" style="height: 300vh">
      <button #trigger (click)="openPopover()" class="absolute" style="right: 0.4rem; top: 40rem" type="button">
        Open popover
      </button>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
})
export class OverlayRuntimePopoverStorybookComponent {
  private runtime = injectOverlayRuntime();
  private trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  viewportPadding = input(24);

  openPopover() {
    const ref = this.runtime.mount({
      id: 'et-sb-runtime-popover',
      component: OverlayRuntimeStorybookPopoverComponent,
      role: 'dialog',
      ariaLabel: 'Popover',
      modal: false,
      hasBackdrop: false,
      autoFocus: false,
      positionStrategy: anchoredOverlayPosition({
        referenceElement: this.trigger().nativeElement,
        placement: 'top',
        viewportPadding: this.viewportPadding(),
      }),
    });

    attachRef(ref);
  }
}
