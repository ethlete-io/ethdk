import { ComponentPortal, DomPortalOutlet } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ComponentFactoryResolver,
  ElementRef,
  inject,
  Injector,
  Input,
  Renderer2,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import { CONTENTFUL_CONFIG } from '../../constants';
import { RichTextResponse } from '../../types';
import { ContentfulConfig } from '../../utils';
import { RichTextRenderCommand } from './rich-text-renderer.types';
import { createRenderCommandsFromContentfulRichText } from './rich-text-renderer.util';

@Component({
  selector: 'et-contentful-rich-text-renderer',
  template: ``,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class ContentfulRichTextRendererComponent {
  @Input()
  get richText() {
    return this._richText;
  }
  set richText(v: RichTextResponse | null) {
    this._richText = v;

    // clear the element
    this._viewContainerRef.clear();

    if (!v) {
      return;
    }

    const commands = createRenderCommandsFromContentfulRichText({ data: v, config: this._config });

    this._render(commands);
  }
  private _richText: RichTextResponse | null = null;

  private _renderer = inject(Renderer2);
  private _elementRef = inject(ElementRef);
  private _viewContainerRef = inject(ViewContainerRef);
  private _componentFactoryResolver = inject(ComponentFactoryResolver);
  private _document = inject<Document>(DOCUMENT);
  private _appRef = inject(ApplicationRef);
  private _injector = inject(Injector);
  private _config = inject(CONTENTFUL_CONFIG, { optional: true }) ?? new ContentfulConfig();

  private _render(commands: RichTextRenderCommand[]) {
    // create a document fragment to hold the elements while we create them
    const fragment = document.createDocumentFragment();

    const hostCommand: RichTextRenderCommand = {
      payload: 'document',
      children: commands,
    };

    // loop over the commands
    this._executeCommand({ command: hostCommand, parent: fragment });

    // append the fragment to the host element
    this._renderer.appendChild(this._elementRef.nativeElement, fragment);
  }

  private _executeCommand(data: { command: RichTextRenderCommand; parent: Element | DocumentFragment }) {
    const { command, parent } = data;

    let element: Element | null = null;
    if (command.payload !== 'document') {
      if (typeof command.payload === 'string') {
        element = this._renderer.createElement(command.payload);

        if (command.data) {
          this._renderer.setProperty(element, 'innerText', command.data);
        }

        if (command.attributes) {
          for (const [name, value] of Object.entries(command.attributes)) {
            this._renderer.setAttribute(element, name, value);
          }
        }

        this._renderer.appendChild(parent, element);
      } else {
        const portal = new DomPortalOutlet(
          parent as Element,
          this._componentFactoryResolver,
          this._appRef,
          this._injector,
          this._document,
        );

        const comp = new ComponentPortal(command.payload);
        const ref = comp.attach(portal);

        if (command.data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ref.instance as any).data = command.data;
        }

        element = ref.location.nativeElement;
      }
    }

    // loop over the commands
    for (const childCommand of command.children) {
      this._executeCommand({ command: childCommand, parent: element ?? parent });
    }
  }
}
