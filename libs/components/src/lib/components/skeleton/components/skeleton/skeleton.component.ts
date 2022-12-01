import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';
import { ChangeDetectionStrategy, Component, HostBinding, Input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'et-skeleton',
  template: ` <span class="cdk-visually-hidden"> {{ loadingAllyText }} </span> <ng-content></ng-content>`,
  styleUrls: ['skeleton.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-skeleton',
  },
})
export class SkeletonComponent {
  @Input()
  loadingAllyText = 'Loading...';

  @Input()
  @HostBinding('class.et-skeleton--animated')
  get animated(): boolean {
    return this._animated;
  }
  set animated(value: BooleanInput) {
    this._animated = coerceBooleanProperty(value);
  }
  private _animated = true;
}
