import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Renderer2,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { autoUpdate, computePosition, flip, offset, shift, VirtualElement } from '@floating-ui/dom';
import { IconButtonComponent } from '../../button/icon-button.component';
import { BOLD_ICON, IconDirective, ITALIC_ICON, LINK_ICON, provideIcons, STRIKETHROUGH_ICON } from '../../icon';
import { RichTextEditorDirective } from './headless';

@Component({
  selector: 'et-rich-text-editor-floating-toolbar',
  templateUrl: './rich-text-editor-floating-toolbar.component.html',
  styleUrl: './rich-text-editor-floating-toolbar.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, IconDirective],
  providers: [provideIcons(BOLD_ICON, ITALIC_ICON, STRIKETHROUGH_ICON, LINK_ICON)],
  host: {
    class: 'et-rte-floating-toolbar',
    role: 'toolbar',
    'aria-label': 'Selection formatting',
    '[class.et-rte-floating-toolbar--visible]': 'visible()',
    '[attr.aria-hidden]': '!visible()',
    '(mousedown)': '$event.preventDefault()',
  },
})
export class RichTextEditorFloatingToolbarComponent {
  protected dir = inject(RichTextEditorDirective);

  private document = inject(DOCUMENT);
  private renderer = inject(Renderer2);
  private destroyRef = inject(DestroyRef);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected visible = signal(false);

  private activeRange: Range | null = null;

  private floatingReference: VirtualElement | null = null;

  private floatingCleanup: (() => void) | null = null;

  private pointerSelectingInContent = false;

  constructor() {
    effect((onCleanup) => {
      const root = this.dir.editorDom.root();

      if (!root) return;

      this.floatingReference = {
        // eslint-disable-next-line ethlete/prefer-element-dimensions
        getBoundingClientRect: () => this.activeRange?.getBoundingClientRect() ?? new DOMRect(),
        contextElement: root,
      };

      const listeners = [
        this.renderer.listen(root, 'pointerdown', () => (this.pointerSelectingInContent = true)),
        this.renderer.listen(root, 'keyup', () => this.evaluate()),
        this.renderer.listen(root, 'blur', () => this.hide()),
        this.renderer.listen(this.document, 'pointerup', () => this.finishContentPointerSelection()),
        this.renderer.listen(this.document, 'selectionchange', () => this.reposition()),
      ];

      onCleanup(() => listeners.forEach((off) => off()));
    });

    this.destroyRef.onDestroy(() => this.stop());
  }

  private selectableRange(): Range | null {
    const range = this.dir.editorDom.getSelection()?.range ?? null;
    const usable = !!range && !range.collapsed && this.dir.focused() && !this.dir.disabled() && !this.dir.readonly();

    return usable ? range : null;
  }

  private finishContentPointerSelection() {
    if (!this.pointerSelectingInContent) return;

    this.pointerSelectingInContent = false;
    this.evaluate();
  }

  private evaluate() {
    const range = this.selectableRange();

    if (!range) {
      this.hide();

      return;
    }

    this.activeRange = range.cloneRange();

    if (this.visible()) {
      this.updatePosition();
    } else {
      this.visible.set(true);
      this.start();
    }
  }

  private reposition() {
    if (!this.visible()) return;

    const range = this.selectableRange();

    if (!range) {
      this.hide();

      return;
    }

    this.activeRange = range.cloneRange();
    this.updatePosition();
  }

  private start() {
    this.stop();

    const reference = this.floatingReference;

    if (!reference) return;

    this.floatingCleanup = autoUpdate(reference, this.host.nativeElement, () => this.updatePosition());
  }

  private updatePosition() {
    const reference = this.floatingReference;
    const boundary = this.dir.editorDom.root();

    if (!reference || !boundary || !this.activeRange) return;

    const el = this.host.nativeElement;

    computePosition(reference, el, {
      placement: 'top',
      strategy: 'fixed',
      middleware: [offset(8), flip({ fallbackPlacements: ['bottom'], boundary }), shift({ padding: 8, boundary })],
    }).then(({ x, y }) => {
      this.renderer.setStyle(el, 'transform', `translate3d(${x}px, ${y}px, 0)`);
    });
  }

  private hide() {
    if (this.visible()) {
      this.visible.set(false);
    }

    this.stop();
  }

  private stop() {
    this.floatingCleanup?.();
    this.floatingCleanup = null;
  }
}
