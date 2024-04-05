import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  ElementRef,
  EmbeddedViewRef,
  ViewContainerRef,
  ViewEncapsulation,
  effect,
  inject,
  input,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { QueryDevtoolsComponent } from '@ethlete/query';
import { ProvideThemeDirective } from '@ethlete/theming';

@Component({
  selector: 'ethlete-dyn-comp',
  template: `<p>Data is: {{ data() }}</p> `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class DynCompComponent {
  data = input.required<string>();

  constructor() {
    effect(() => console.log(this.data()));
  }
}

@Component({
  standalone: true,
  imports: [RouterOutlet, RouterLink, QueryDevtoolsComponent, ProvideThemeDirective],
  selector: 'ethlete-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent {
  viewContainerRef = inject(ViewContainerRef);
  elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  compRef: ComponentRef<DynCompComponent> | null = null;

  renderComp() {
    const ref = this.viewContainerRef.createComponent(DynCompComponent);

    ref.setInput('data', 'Hello World');

    const hostNode = (ref.hostView as EmbeddedViewRef<unknown>).rootNodes[0] as HTMLElement;

    this.elementRef.nativeElement.appendChild(hostNode);

    this.compRef = ref;
  }

  updateComp() {
    if (this.compRef) {
      this.compRef.setInput('data', 'Hello Angular');
    }
  }
}
