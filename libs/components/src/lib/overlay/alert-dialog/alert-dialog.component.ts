import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  InjectionToken,
  TemplateRef,
  Type,
  ViewEncapsulation,
  computed,
  inject,
  reflectComponentType,
} from '@angular/core';
import { injectSemanticColorTheme } from '@ethlete/core';
import { ButtonComponent } from '../../button/button.component';
import { OverlayBodyComponent } from '../overlay-body.component';
import { OverlayFooterDirective } from '../overlay-footer.directive';
import { OverlayHeaderDirective } from '../overlay-header.directive';
import { OverlayInputs } from '../overlay-inputs';
import { OverlayMainDirective } from '../overlay-main.directive';
import { OVERLAY_REF } from '../overlay-ref';
import { OverlayTitleDirective } from '../overlay-title.directive';
import { injectAlertDialogLabels } from './alert-dialog-labels';

export const ALERT_DIALOG_INITIAL_FOCUS_ATTRIBUTE = 'data-et-alert-dialog-initial-focus';

export type AlertDialogComponentSlot<TComponent> = {
  /** An app component rendered under the message. */
  component: Type<TComponent>;
  /** Values for its signal inputs, as getters, like an overlay's `inputs`: `{ user: () => user }`. */
  inputs?: NoInfer<OverlayInputs<TComponent>>;
};

export type AlertDialogTemplateSlot<TContext> = {
  /** An app template rendered under the message. */
  template: TemplateRef<TContext>;
  /** The template's context. */
  context?: TContext;
};

export type AlertDialogSlot<TComponent = unknown, TContext = unknown> =
  AlertDialogComponentSlot<TComponent> | AlertDialogTemplateSlot<TContext>;

export type AlertDialogContent = {
  kind: 'confirm' | 'alert';
  title: string;
  message: string | null;
  messageId: string;
  confirmLabel: string | null;
  cancelLabel: string | null;
  acknowledgeLabel: string | null;
  destructive: boolean;
  slot: AlertDialogSlot | null;
};

export const ALERT_DIALOG_CONTENT = new InjectionToken<AlertDialogContent>('ALERT_DIALOG_CONTENT');

@Component({
  selector: 'et-alert-dialog',
  template: `
    <div etOverlayHeader>
      <h2 class="et-alert-dialog-title" et-overlay-title>{{ content.title }}</h2>
    </div>

    @if (content.message || content.slot) {
      <div et-overlay-body>
        @if (content.message) {
          <p [id]="content.messageId" class="et-alert-dialog-message">{{ content.message }}</p>
        }
        @if (slotComponent) {
          <div class="et-alert-dialog-slot">
            <ng-container [ngComponentOutlet]="slotComponent" [ngComponentOutletInputs]="slotInputs()" />
          </div>
        } @else if (slotTemplate) {
          <div class="et-alert-dialog-slot">
            <ng-container [ngTemplateOutlet]="slotTemplate" [ngTemplateOutletContext]="slotContext" />
          </div>
        }
      </div>
    }

    <div class="et-alert-dialog-actions" etOverlayFooter>
      @if (content.kind === 'confirm') {
        <button
          (click)="overlayRef.close(false)"
          et-button
          variant="outline"
          type="button"
          data-et-alert-dialog-initial-focus
        >
          {{ cancelLabel() }}
        </button>
        <button [color]="confirmColor()" (click)="overlayRef.close(true)" et-button variant="filled" type="button">
          {{ confirmLabel() }}
        </button>
      } @else {
        <button
          (click)="overlayRef.close(true)"
          et-button
          variant="filled"
          type="button"
          data-et-alert-dialog-initial-focus
        >
          {{ acknowledgeLabel() }}
        </button>
      }
    </div>
  `,
  styleUrl: './alert-dialog.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ButtonComponent,
    NgComponentOutlet,
    NgTemplateOutlet,
    OverlayBodyComponent,
    OverlayFooterDirective,
    OverlayHeaderDirective,
    OverlayTitleDirective,
  ],
  hostDirectives: [OverlayMainDirective],
  host: {
    class: 'et-alert-dialog',
    '[attr.data-kind]': 'content.kind',
  },
})
export class AlertDialogComponent {
  private labels = injectAlertDialogLabels();

  protected overlayRef = inject(OVERLAY_REF);
  protected content = inject(ALERT_DIALOG_CONTENT);
  private errorTheme = injectSemanticColorTheme('error');

  protected confirmColor = computed(() => (this.content.destructive ? this.errorTheme() : undefined));

  private componentSlot = this.content.slot && 'component' in this.content.slot ? this.content.slot : null;
  private templateSlot = this.content.slot && 'template' in this.content.slot ? this.content.slot : null;

  protected slotComponent = this.componentSlot?.component ?? null;
  protected slotTemplate = this.templateSlot?.template ?? null;
  protected slotContext = this.templateSlot?.context ?? null;

  protected slotInputs = computed(() => {
    if (!this.componentSlot?.inputs) return {};

    const declaredInputs = reflectComponentType(this.componentSlot.component)?.inputs ?? [];

    return Object.fromEntries(
      Object.entries(this.componentSlot.inputs).map(([propName, getter]) => [
        declaredInputs.find((declared) => declared.propName === propName)?.templateName ?? propName,
        (getter as () => unknown)(),
      ]),
    );
  });

  protected confirmLabel = computed(() => this.content.confirmLabel ?? this.labels().confirm);
  protected cancelLabel = computed(() => this.content.cancelLabel ?? this.labels().cancel);
  protected acknowledgeLabel = computed(() => this.content.acknowledgeLabel ?? this.labels().acknowledge);
}
