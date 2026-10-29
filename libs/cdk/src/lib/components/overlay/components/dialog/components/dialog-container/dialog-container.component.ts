import { PortalModule } from '@angular/cdk/portal';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { AnimatedLifecycleDirective, nextFrame } from '@ethlete/core';
import { DialogContainerBaseComponent } from '../../partials/dialog-container-base';

/**
 * @deprecated Will be removed in v5.
 */
@Component({
  selector: 'et-dialog-container',
  styleUrls: ['./dialog-container.component.scss'],
  template: `<ng-template cdkPortalOutlet />`,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-dialog',
    tabindex: '-1',
    '[attr.aria-modal]': '_config.ariaModal',
    '[id]': '_config.id',
    '[attr.role]': '_config.role',
    '[attr.aria-labelledby]': '_config.ariaLabel ? null : _ariaLabelledByHack',
    '[attr.aria-label]': '_config.ariaLabel',
    '[attr.aria-describedby]': '_config.ariaDescribedBy || null',
    '[class.et-with-default-animation]': '!_config.customAnimated',
    '[class]': '_config.containerClass',
  },
  imports: [PortalModule],
  hostDirectives: [AnimatedLifecycleDirective],
})
export class DialogContainerComponent extends DialogContainerBaseComponent {
  get _ariaLabelledByHack() {
    // @ts-expect-error private property
    return super._ariaLabelledBy;
  }

  protected override _contentAttached(): void {
    super._contentAttached();

    nextFrame(() => {
      this._animatedLifecycle.enter();
    });
  }
}
