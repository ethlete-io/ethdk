import { Component, InjectionToken, ViewEncapsulation, computed, inject } from '@angular/core';
import { ColorTheme, injectErrorTheme } from '@ethlete/core';
import { ButtonComponent } from '../../button/button.component';
import { OverlayBodyComponent } from '../overlay-body.component';
import { OverlayFooterDirective } from '../overlay-footer.directive';
import { OverlayHeaderDirective } from '../overlay-header.directive';
import { OverlayMainDirective } from '../overlay-main.directive';
import { OVERLAY_REF } from '../overlay-ref';
import { OverlayTitleDirective } from '../overlay-title.directive';
import { injectAlertDialogLabels } from './alert-dialog-labels';

export const ALERT_DIALOG_INITIAL_FOCUS_ATTRIBUTE = 'data-et-alert-dialog-initial-focus';

export type AlertDialogContent = {
  kind: 'confirm' | 'alert';
  title: string;
  message: string | null;
  messageId: string;
  confirmLabel: string | null;
  cancelLabel: string | null;
  acknowledgeLabel: string | null;
  destructive: boolean;
};

export const ALERT_DIALOG_CONTENT = new InjectionToken<AlertDialogContent>('ALERT_DIALOG_CONTENT');

@Component({
  selector: 'et-alert-dialog',
  template: `
    <div etOverlayHeader>
      <h2 class="et-alert-dialog-title" et-overlay-title>{{ content.title }}</h2>
    </div>

    @if (content.message) {
      <div et-overlay-body>
        <p [id]="content.messageId" class="et-alert-dialog-message">{{ content.message }}</p>
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
        <button [color]="confirmColor" (click)="overlayRef.close(true)" et-button variant="filled" type="button">
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
  protected confirmColor: ColorTheme | undefined = this.content.destructive ? injectErrorTheme() : undefined;

  protected confirmLabel = computed(() => this.content.confirmLabel ?? this.labels().confirm);
  protected cancelLabel = computed(() => this.content.cancelLabel ?? this.labels().cancel);
  protected acknowledgeLabel = computed(() => this.content.acknowledgeLabel ?? this.labels().acknowledge);
}
