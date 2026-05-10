import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  TemplateRef,
  ViewEncapsulation,
  inject,
  viewChild,
} from '@angular/core';
import {
  ANIMATED_LIFECYCLE_TOKEN,
  AnimatedLifecycleDirective,
  COLOR_PROVIDER,
  ProvideColorDirective,
} from '@ethlete/core';
import { SELECT_BODY_TOKEN, SelectBodyDirective } from '../../directives/select-body';

@Component({
  selector: 'et-select-body',
  template: `
    <div #containerElement class="et-select-body-container" etAnimatedLifecycle>
      <ng-container [ngTemplateOutlet]="_bodyTemplate" />
    </div>
  `,
  styleUrls: ['./select-body.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-select-body et-with-default-animation',
  },
  imports: [AnimatedLifecycleDirective, NgTemplateOutlet],
  hostDirectives: [SelectBodyDirective, ProvideColorDirective],
})
export class SelectBodyComponent {
  readonly selectBody = inject(SELECT_BODY_TOKEN);
  private readonly colorProvider = inject(COLOR_PROVIDER);
  readonly animatedLifecycle = viewChild(ANIMATED_LIFECYCLE_TOKEN);

  readonly _containerElementRef = viewChild<string, ElementRef<HTMLElement>>('containerElement', { read: ElementRef });

  _bodyTemplate: TemplateRef<unknown> | null = null;

  setColorFromProvider(provider: ProvideColorDirective) {
    this.colorProvider.syncWithProvider(provider);
  }
}
