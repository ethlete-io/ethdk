import { ComponentPortal, DomPortalOutlet } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ComponentFactoryResolver,
  ElementRef,
  Injector,
  Input,
  Renderer2,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { CONTENTFUL_CONFIG } from '../../constants/contentful.constants';
import { RichTextResponse } from '../../types';
import { createContentfulConfig } from '../../utils/contentful-config';
import { ContentfulImageComponent } from '../image';
import { RICH_TEXT_RENDERER_COMPONENT_DATA } from './rich-text-renderer.constants';
import { RichTextRenderCommand } from './rich-text-renderer.types';
import { createRenderCommandsFromContentfulRichText } from './rich-text-renderer.util';

@Component({
  selector: 'et-contentful-rich-text-renderer',
  template: ``,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    class: 'et-contentful-rich-text-renderer',
  },
})
export class ContentfulRichTextRendererComponent {
  @Input()
  get richText() {
    return this._richText;
  }
  set richText(v: RichTextResponse | null | undefined) {
    this._richText = v ?? null;

    this.resetAndRender();
  }
  private _richText: RichTextResponse | null = null;

  private _renderer = inject(Renderer2);
  private _elementRef = inject(ElementRef);
  private _componentFactoryResolver = inject(ComponentFactoryResolver);
  private _document = inject(DOCUMENT);
  private _appRef = inject(ApplicationRef);
  private _injector = inject(Injector);
  private _config = inject(CONTENTFUL_CONFIG, { optional: true }) ?? createContentfulConfig();

  resetAndRender() {
    // clear childNodes to prevent appending new richtext elements to existing one
    const childElements = this._elementRef.nativeElement.childNodes;
    for (const child of childElements) {
      this._renderer.removeChild(this._elementRef.nativeElement, child);
    }

    if (!this._richText) {
      return;
    }

    const commands = createRenderCommandsFromContentfulRichText({ data: this._richText, config: this._config });

    this._render(commands);
  }

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
        const injector = Injector.create({
          providers: [
            {
              provide: RICH_TEXT_RENDERER_COMPONENT_DATA,
              useValue: command.data,
            },
          ],
          parent: this._injector,
        });

        const portal = new DomPortalOutlet(
          parent as Element,
          this._componentFactoryResolver,
          this._appRef,
          injector,
          this._document,
        );

        const comp = new ComponentPortal(command.payload);
        const ref = comp.attach(portal);

        if (ref.instance instanceof ContentfulImageComponent) {
          ref.instance.sizes = this._config.imageOptions.sizes;
          ref.instance.srcsetSizes = this._config.imageOptions.srcsetSizes;
          ref.instance.backgroundColor = this._config.imageOptions.backgroundColor;
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
