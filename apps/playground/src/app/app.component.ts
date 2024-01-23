import { ChangeDetectionStrategy, Component, Injector, ViewEncapsulation, inject, input, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { QueryDevtoolsComponent } from '@ethlete/query';
import { ProvideThemeDirective } from '@ethlete/theming';
import {
  ArchTestAccordionComponent,
  ArchTestAccordionItemComponent,
  ArchTestOverlayTriggerDirective,
} from './cdk/arch/arch.component';

@Component({
  selector: 'ethlete-overlay-test-component',
  template: `<p>Test</p>
    <p>{{ foo() }}</p> `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [],
  hostDirectives: [],
})
export class TestCompComponent {
  foo = input();
}

@Component({
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    QueryDevtoolsComponent,
    ProvideThemeDirective,
    ArchTestAccordionComponent,
    ArchTestAccordionItemComponent,
    ArchTestOverlayTriggerDirective,
  ],
  selector: 'ethlete-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  injector = inject(Injector);
  showFourth = signal(false);

  comp = TestCompComponent;

  constructor() {
    setTimeout(() => {
      this.showFourth.set(true);
    }, 1000);
  }
}
