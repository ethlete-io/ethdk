import { Component, viewChild, ViewEncapsulation } from '@angular/core';
import { TitleBarComponent } from '../components/title-bar/title-bar.component';

@Component({
  selector: 'ethlete-design-harness-update-stage',
  template: `
    <ethlete-title-bar
      [right]="['minimize', 'maximize', 'close']"
      [update]="true"
      os="linux"
      product="studio"
      part="Title bar"
    />
    <div class="flex-1 border-t border-et-surface-border"></div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TitleBarComponent],
  host: { class: 'flex size-full flex-col bg-et-surface-bg' },
})
export class DesignHarnessUpdateStageComponent {
  private titleBar = viewChild.required(TitleBarComponent);

  public origin() {
    return this.titleBar().updateButton()?.nativeElement ?? null;
  }
}
