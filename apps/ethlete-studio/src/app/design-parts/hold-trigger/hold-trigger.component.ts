import { NgTemplateOutlet } from '@angular/common';
import { Component, input, output, TemplateRef, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'ethlete-hold-trigger',
  template: `
    <button
      [attr.aria-expanded]="open()"
      (click)="openChange.emit(!open())"
      class="-m-space-1 flex cursor-pointer rounded-control-sm border-0 bg-transparent p-space-1 [transition:var(--transition-state)] outline-none hover:bg-et-surface-interaction/10 focus-visible:shadow-[inset_0_0_0_1.5px_var(--focus-ring)] focus-visible:outline-none active:bg-et-surface-interaction/15"
      type="button"
      data-sk-hold
    >
      <ng-container [ngTemplateOutlet]="content()" />
    </button>
    <span
      [hidden]="!open()"
      class="flex min-w-0 items-center gap-space-2 text-ui-sm whitespace-nowrap text-et-surface-muted"
      data-sk-hold-reason
    >
      <ng-container [ngTemplateOutlet]="reason()" />
    </span>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet],
  host: { class: 'flex min-w-0 items-center gap-space-2' },
})
export class HoldTriggerComponent {
  public content = input<TemplateRef<unknown> | null>(null);
  public reason = input<TemplateRef<unknown> | null>(null);
  public open = input(false);

  public openChange = output<boolean>();
}
