import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, ViewEncapsulation, inject } from '@angular/core';
import { createComponentId } from '@ethlete/core';
import { MENU_SELECTION_GROUP_TOKEN } from './headless';

@Component({
  selector: 'et-menu-group-label',
  template: `<ng-content />`,
  styleUrl: './menu-group-label.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-menu-group-label',
    role: 'presentation',
  },
})
export class MenuGroupLabelComponent {
  private group = inject(MENU_SELECTION_GROUP_TOKEN, { optional: true });
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  constructor() {
    const element = this.elementRef.nativeElement;

    if (!element.id) {
      element.id = createComponentId('et-menu-group-label');
    }

    this.group?.labelId.set(element.id);

    this.destroyRef.onDestroy(() => {
      this.group?.labelId.set(null);
    });
  }
}
