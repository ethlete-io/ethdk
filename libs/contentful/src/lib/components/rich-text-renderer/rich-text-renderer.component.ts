import { ComponentType } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  ElementRef,
  EmbeddedViewRef,
  Renderer2,
  ViewContainerRef,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BLOCKS, Block, INLINES, Inline, Mark, Text } from '@contentful/rich-text-types';
import { getObjectProperty, isObject } from '@ethlete/core';
import { pairwise, startWith, tap } from 'rxjs';
import { CONTENTFUL_CONFIG } from '../../constants/contentful.constants';
import { ContentfulAssetNew, ContentfulCollection, ContentfulEntryNew, RichTextResponseNew } from '../../types';
import { createContentfulConfig } from '../../utils/contentful-config';
import { richTextRendererError } from './rich-text-renderer.errors';
import { isRichTextRootNode, translateContentfulNodeTypeToHtmlTag } from './rich-text-renderer.util';

export const RENDER_COMMAND_TYPE = {
  HTML_OPEN: 0,
  HTML_CLOSE: 1,
  TEXT: 2,
  COMPONENT: 3,
} as const;

export const RENDER_COMMAND_POSITION = {
  TYPE: 0,
  NESTING_LEVEL: 1,
  DOM_POSITION: 2,
} as const;

export const HTML_OPEN_RENDER_COMMAND_POSITION = {
  ATTRIBUTES: 3,
  TAG_NAME: 4,
  ELEMENT_ID: 5,
} as const;

export const HTML_CLOSE_RENDER_COMMAND_POSITION = {
  TAG_NAME: 3,
  ELEMENT_ID: 4,
} as const;

export const TEXT_RENDER_COMMAND_POSITION = {
  TEXT: 3,
} as const;

export const COMPONENT_RENDER_COMMAND_POSITION = {
  ATTRIBUTES: 3,
  COMPONENT: 4,
  INPUTS: 5,
  COMPONENT_TYPE: 6,
} as const;

type HtmlOpenRenderCommand = [
  type: typeof RENDER_COMMAND_TYPE.HTML_OPEN,
  nestingLevel: number,
  domPosition: number,
  attributes: Record<string, string>,
  tagName: string,
  elementId: string,
];

type HtmlCloseRenderCommand = [
  type: typeof RENDER_COMMAND_TYPE.HTML_CLOSE,
  nestingLevel: number,
  domPosition: number,
  tagName: string,
  elementId: string,
];

type TextRenderCommand = [
  type: typeof RENDER_COMMAND_TYPE.TEXT,
  nestingLevel: number,
  domPosition: number,
  text: string,
];

type ComponentRenderCommand = [
  type: typeof RENDER_COMMAND_TYPE.COMPONENT,
  nestingLevel: number,
  domPosition: number,
  attributes: Record<string, string>,
  component: ComponentType<unknown>,
  inputs: Record<string, unknown>,
  componentType: string,
];

type RenderCommand = HtmlOpenRenderCommand | HtmlCloseRenderCommand | TextRenderCommand | ComponentRenderCommand;

export const RENDER_INSTRUCTION_POSITION = {
  TYPE: 0,
  COMMAND: 1,
} as const;

export const RENDER_INSTRUCTION_TYPE = {
  CREATE: 0,
  UPDATE: 1,
  DELETE: 2,
} as const;

type RenderInstructionTypeValue = (typeof RENDER_INSTRUCTION_TYPE)[keyof typeof RENDER_INSTRUCTION_TYPE];

type RenderInstruction = [RenderInstructionTypeValue, RenderCommand];

const MARK_TAILWIND_MAP: Record<string, string> = {
  bold: 'font-bold',
  italic: 'italic',
  underline: 'underline',
  code: 'font-mono',
};

export const marksToClass = (marks: Mark[]) => {
  const classes: string[] = [];

  for (const mark of marks) {
    let klass = MARK_TAILWIND_MAP[mark.type];

    if (!klass) {
      console.warn(`No class found for mark type! Falling back to "${mark.type}".`, mark);

      klass = mark.type;
    }

    classes.push(klass);
  }

  return classes.join(' ');
};

export const isHtmlOpenRenderCommand = (command: RenderCommand): command is HtmlOpenRenderCommand => {
  return command[RENDER_COMMAND_POSITION.TYPE] === RENDER_COMMAND_TYPE.HTML_OPEN;
};

export const isHtmlCloseRenderCommand = (command: RenderCommand): command is HtmlCloseRenderCommand => {
  return command[RENDER_COMMAND_POSITION.TYPE] === RENDER_COMMAND_TYPE.HTML_CLOSE;
};

export const isTextRenderCommand = (command: RenderCommand): command is TextRenderCommand => {
  return command[RENDER_COMMAND_POSITION.TYPE] === RENDER_COMMAND_TYPE.TEXT;
};

export const isComponentRenderCommand = (command: RenderCommand): command is ComponentRenderCommand => {
  return command[RENDER_COMMAND_POSITION.TYPE] === RENDER_COMMAND_TYPE.COMPONENT;
};

export const getRenderCommandId = (command: RenderCommand) => {
  if (isHtmlOpenRenderCommand(command)) {
    return command[HTML_OPEN_RENDER_COMMAND_POSITION.ELEMENT_ID];
  } else if (isHtmlCloseRenderCommand(command)) {
    return command[HTML_CLOSE_RENDER_COMMAND_POSITION.ELEMENT_ID];
  } else if (isTextRenderCommand(command)) {
    return command[TEXT_RENDER_COMMAND_POSITION.TEXT];
  } else {
    return command[COMPONENT_RENDER_COMMAND_POSITION.COMPONENT_TYPE];
  }
};

const CLASS_ATTR = 'class';
const DEFAULT_COMPONENT_TYPES = {
  IMAGE: '$$$_et-image',
  VIDEO: '$$$_et-video',
  AUDIO: '$$$_et-audio',
  FILE: '$$$_et-file',
};

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
  /**
   * The contentful response gotten via their REST api.
   * @see https://www.contentful.com/developers/docs/references/content-delivery-api/#/reference/entries/entries-collection
   */
  content = input.required<ContentfulCollection | null | undefined>();

  /**
   * The path to where the rich text field is inside the contentful response. Dot and array notation is allowed.
   * @default "items[0].fields.html"
   */
  richTextPath = input('items[0].fields.html');

  /**
   * A map of all includes in the contentful response.
   * This is useful for looking up assets and entries that are referenced in the rich text without having to use loops.
   */
  contentIncludesMap = computed(() => {
    const content = this.content();
    const assets = content?.includes.Asset;
    const entries = content?.includes.Entry;

    return {
      assets:
        assets?.reduce(
          (acc, asset) => {
            acc[asset.sys.id] = asset;
            return acc;
          },
          {} as Record<string, ContentfulAssetNew>,
        ) ?? {},
      entries:
        entries?.reduce(
          (acc, entry) => {
            acc[entry.sys.id] = entry;
            return acc;
          },
          {} as Record<string, ContentfulEntryNew>,
        ) ?? {},
    };
  });

  /**
   * The rich text data that should be rendered.
   */
  richTextData = computed(() => {
    const content = this.content();
    const richTextPath = this.richTextPath();

    if (!content) {
      return null;
    }

    const richText = getObjectProperty(content as unknown as Record<string, unknown>, richTextPath);

    if (!isObject(richText)) {
      throw richTextRendererError('rich_text_undefined', false, { content, richTextPath });
    }

    if (!isRichTextRootNode(richText)) {
      throw richTextRendererError('rich_text_wrong_type', false, { content, richTextPath });
    }

    return richText as RichTextResponseNew;
  });

  renderCommands = computed(() => {
    const richTextData = this.richTextData();

    if (!richTextData) {
      return [];
    }

    return this._createRenderCommands(richTextData);
  });

  renderCommandHistory = toSignal(
    toObservable(this.renderCommands).pipe(startWith([] as RenderCommand[]), pairwise()),
    { initialValue: [[], []] },
  );

  previousRenderCommandMap = computed(() => {
    const [prevCommands] = this.renderCommandHistory();

    const map = new Map<string | number, RenderCommand>();

    for (const command of prevCommands) {
      map.set(getRenderCommandId(command), command);
    }

    return map;
  });

  renderInstructions = computed(() => {
    const commands = this.renderCommands();
    const previousRenderCommandMap = new Map(this.previousRenderCommandMap());

    const instructions: RenderInstruction[] = [];

    // remove deleted components as well as all other elements
    for (const [, command] of previousRenderCommandMap) {
      if (isComponentRenderCommand(command)) {
        // keep the component around if it's still in the new commands
        if (commands.some((c) => getRenderCommandId(c) === getRenderCommandId(command))) {
          continue;
        }
      }

      instructions.push([RENDER_INSTRUCTION_TYPE.DELETE, command]);

      // remove from map to mark as used
      previousRenderCommandMap.delete(getRenderCommandId(command));
    }

    // update existing components
    for (const command of commands) {
      if (!isComponentRenderCommand(command)) continue;

      const id = getRenderCommandId(command);
      const previousCommand = previousRenderCommandMap.get(id);

      if (!previousCommand) continue;

      instructions.push([RENDER_INSTRUCTION_TYPE.UPDATE, command]);
    }

    for (const command of commands) {
      const id = getRenderCommandId(command);

      if (isComponentRenderCommand(command)) {
        const previousCommand = previousRenderCommandMap.get(id);

        if (!previousCommand) {
          // create
          instructions.push([RENDER_INSTRUCTION_TYPE.CREATE, command]);
        }
      } else {
        // create
        instructions.push([RENDER_INSTRUCTION_TYPE.CREATE, command]);
      }
    }

    return instructions;
  });

  _viewContainerRef = inject(ViewContainerRef);
  _renderer = inject(Renderer2);
  _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  _document = inject(DOCUMENT);
  _config = inject(CONTENTFUL_CONFIG, { optional: true }) ?? createContentfulConfig();

  constructor() {
    toObservable(this.renderInstructions)
      .pipe(
        takeUntilDestroyed(),
        tap((instructions) => {
          this._execInstructions(instructions);
        }),
      )
      .subscribe();

    effect(() => {
      this._debugVisualizeRenderCommands(this.renderCommands());
    });
  }

  private _createRenderCommands(richTextData: RichTextResponseNew) {
    /** List of all render commands */
    const rootCommands: RenderCommand[] = [];

    /** Counter for generating unique html element IDs. */
    let elementId = 0;

    /** Counter for generating unique component IDs. */
    let componentId = 0;

    /** The nesting level of the current node. */
    let nestingLevel = 0;

    /** The position (index) of the current node inside the parent node. */
    let domPosition = 0;

    const traverse = (node: Block | Inline | Text, parent: RenderCommand | null = null) => {
      switch (node.nodeType) {
        case 'text': {
          // Render media
          const type = RENDER_COMMAND_TYPE.TEXT;
          const text = node.value;

          if (!text) break;

          const command: TextRenderCommand = [type, nestingLevel, domPosition, text];

          rootCommands.push(command);
          domPosition++;

          if (!parent) {
            throw richTextRendererError('text_parent_not_found', false, { node });
          }
          if (!isHtmlOpenRenderCommand(parent) && !isComponentRenderCommand(parent)) {
            throw richTextRendererError('text_parent_wrong_type', false, { node, parent });
          }

          const attributesPosition =
            parent[RENDER_COMMAND_POSITION.TYPE] === RENDER_COMMAND_TYPE.HTML_OPEN
              ? HTML_OPEN_RENDER_COMMAND_POSITION.ATTRIBUTES
              : COMPONENT_RENDER_COMMAND_POSITION.ATTRIBUTES;

          const attributes = parent[attributesPosition];

          if (node.marks.length) {
            const markClasses = marksToClass(node.marks);

            if (CLASS_ATTR in attributes) {
              attributes[CLASS_ATTR] += ` ${markClasses}`;
            } else {
              attributes[CLASS_ATTR] = markClasses;
            }
          }

          break;
        }

        case BLOCKS.EMBEDDED_ASSET: {
          // Render media
          const type = RENDER_COMMAND_TYPE.COMPONENT;
          const assetId = node.data['target']?.sys?.id;

          if (!assetId) {
            throw richTextRendererError('asset_id_not_found', false, { node });
          }

          const asset = this.contentIncludesMap().assets[assetId];

          if (!asset) {
            throw richTextRendererError('asset_not_found', false, { assetId, node });
          }

          const contentType = asset.fields.file.contentType;
          const assetComponents = this._config.components;

          const isImage = contentType.startsWith('image/');
          const isVideo = contentType.startsWith('video/');
          const isAudio = contentType.startsWith('audio/');

          const component = isImage
            ? assetComponents.image
            : isVideo
              ? assetComponents.video
              : isAudio
                ? assetComponents.audio
                : assetComponents.file;

          const componentType = isImage
            ? DEFAULT_COMPONENT_TYPES.IMAGE
            : isVideo
              ? DEFAULT_COMPONENT_TYPES.VIDEO
              : isAudio
                ? DEFAULT_COMPONENT_TYPES.AUDIO
                : DEFAULT_COMPONENT_TYPES.FILE;

          const id = componentType + componentId;

          const attributes = {};

          const inputs = {
            asset,
          };

          const command: ComponentRenderCommand = [type, nestingLevel, domPosition, attributes, component, inputs, id];

          rootCommands.push(command);

          domPosition++;

          break;
        }

        case BLOCKS.EMBEDDED_ENTRY:
        case INLINES.EMBEDDED_ENTRY: {
          // Render component
          const type = RENDER_COMMAND_TYPE.COMPONENT;
          const entryId = node.data['target']?.sys?.id;

          if (!entryId) {
            throw richTextRendererError('entry_id_not_found', false, { node });
          }

          const entry = this.contentIncludesMap().entries[entryId];

          if (!entry) {
            throw richTextRendererError('entry_not_found', false, { entryId, node });
          }

          const componentType = entry.sys.contentType.sys.id;

          const component = this._config.customComponents[componentType];

          if (!component) {
            throw richTextRendererError('custom_component_not_found', false, {
              componentType,
              customComponents: this._config.customComponents,
              entry,
            });
          }

          const attributes = {};
          const id = componentType + componentId++;

          const inputs = {
            entry,
            includes: this.contentIncludesMap(),
          };

          const command: ComponentRenderCommand = [type, nestingLevel, domPosition, attributes, component, inputs, id];

          rootCommands.push(command);

          domPosition++;

          break;
        }

        default: {
          const type = RENDER_COMMAND_TYPE.HTML_OPEN;
          const tag = translateContentfulNodeTypeToHtmlTag(node.nodeType);
          const attributes: Record<string, string> = {};
          const id = 'e' + elementId++;

          const command: HtmlOpenRenderCommand = [type, nestingLevel, domPosition, attributes, tag, id];

          rootCommands.push(command);

          const domPositionAtThisLevel = domPosition;
          // Normal html elements can have children
          for (const child of node.content) {
            domPosition = 0;
            nestingLevel++;
            traverse(child, command);
            nestingLevel--;
            domPosition = domPositionAtThisLevel;
          }

          const lastCommand = rootCommands[rootCommands.length - 1];

          if (lastCommand?.[RENDER_COMMAND_POSITION.TYPE] === RENDER_COMMAND_TYPE.HTML_OPEN) {
            // If the last command is an open command, we can remove it since it's empty
            rootCommands.pop();
          } else {
            const closeCommand: HtmlCloseRenderCommand = [
              RENDER_COMMAND_TYPE.HTML_CLOSE,
              nestingLevel,
              domPosition,
              tag,
              id,
            ];
            rootCommands.push(closeCommand);

            domPosition++;
          }

          if (node.nodeType === INLINES.HYPERLINK) {
            const uri = node.data['uri'];
            attributes['href'] = uri;

            const host = this._document.location.host;
            const isExternal = !uri.includes(host);

            if (isExternal) {
              attributes['target'] = '_blank';
            }
          }

          break;
        }
      }
    };

    for (const node of richTextData.content) {
      traverse(node, null);
    }

    return rootCommands;
  }

  _commandCache = new Map<
    string,
    {
      command: RenderCommand;
      componentRef?: ComponentRef<unknown>;
      element?: HTMLElement;
    }
  >();

  private _execInstructions(instructions: RenderInstruction[]) {
    for (const instruction of instructions) {
      const type = instruction[RENDER_INSTRUCTION_POSITION.TYPE];
      const command = instruction[RENDER_INSTRUCTION_POSITION.COMMAND];

      switch (type) {
        case RENDER_INSTRUCTION_TYPE.CREATE:
          this._runCreateInstruction(command);
          break;
        case RENDER_INSTRUCTION_TYPE.UPDATE:
          this._runUpdateInstruction(command);
          break;
        case RENDER_INSTRUCTION_TYPE.DELETE:
          this._runDeleteInstruction(command);
          break;
      }
    }
  }

  _createParents: HTMLElement[] = [];

  private _runCreateInstruction(command: RenderCommand) {
    const id = getRenderCommandId(command);

    const domPosition = command[RENDER_COMMAND_POSITION.DOM_POSITION];
    const nestingLevel = command[RENDER_COMMAND_POSITION.NESTING_LEVEL];

    const hostElement = this._elementRef.nativeElement;

    const upperSibling =
      nestingLevel === 0 && hostElement.children.length ? hostElement.children[domPosition - 1] : null;

    console.log({ upperSibling }, 'for', command);

    // TODO: Find out what is currently the parent element.
    // If the nestingLevel is 0, the parent element is the host element.
    // If the nestingLevel is greater than 0, the parent element is???

    // TODO: Try to find an already rendered element with a domPosition that is greater than the current domPosition. If there are multiple, use the one with the smallest domPosition.
    // If it does not exist, use .appendChild to simply append the element to the end of the parent element.
    // If it does exist, use .insertBefore to insert the element before the found element.

    if (isComponentRenderCommand(command)) {
      const componentRef = this._viewContainerRef.createComponent(command[COMPONENT_RENDER_COMMAND_POSITION.COMPONENT]);

      for (const [key, value] of Object.entries(command[COMPONENT_RENDER_COMMAND_POSITION.INPUTS])) {
        componentRef.setInput(key, value);
      }

      this._renderer.appendChild(this._elementRef.nativeElement, this._getComponentRootNode(componentRef));

      this._commandCache.set(id, {
        command,
        componentRef,
      });
    } else if (isTextRenderCommand(command)) {
      const text = command[TEXT_RENDER_COMMAND_POSITION.TEXT];
      const textNode = this._renderer.createText(text);
      const span = this._renderer.createElement('span');

      const parent = this._createParents[this._createParents.length - 1];

      if (parent) {
        this._renderer.appendChild(parent, span);
      } else {
        this._renderer.appendChild(this._elementRef.nativeElement, span);
      }

      this._renderer.appendChild(span, textNode);

      this._commandCache.set(id, {
        command,
        element: span,
      });
    } else if (isHtmlOpenRenderCommand(command)) {
      const tag = command[HTML_OPEN_RENDER_COMMAND_POSITION.TAG_NAME];
      const attributes = command[HTML_OPEN_RENDER_COMMAND_POSITION.ATTRIBUTES];
      const element = this._renderer.createElement(tag);

      for (const [key, value] of Object.entries(attributes)) {
        this._renderer.setAttribute(element, key, value);
      }

      const parent = this._createParents[this._createParents.length - 1];

      if (parent) {
        this._renderer.appendChild(parent, element);
      } else {
        this._renderer.appendChild(this._elementRef.nativeElement, element);
      }

      this._createParents.push(element);

      this._commandCache.set(id, {
        command,
        element,
      });
    } else if (isHtmlCloseRenderCommand(command)) {
      const tag = command[HTML_CLOSE_RENDER_COMMAND_POSITION.TAG_NAME];
      const parent = this._createParents.pop();

      if (!parent) {
        throw new Error('Parent element not found!');
      }

      if (parent.tagName.toLowerCase() !== tag) {
        throw new Error(`Expected closing tag "${tag}" but got "${parent.tagName.toLowerCase()}".`);
      }
    }
  }

  private _runUpdateInstruction(command: RenderCommand) {
    const id = getRenderCommandId(command);
    const cached = this._commandCache.get(id);

    if (!cached) {
      throw new Error('Cached command not found!');
    }

    if (isComponentRenderCommand(command)) {
      const componentRef = cached.componentRef;

      if (!componentRef) {
        throw new Error('Component ref not found!');
      }

      for (const [key, value] of Object.entries(command[COMPONENT_RENDER_COMMAND_POSITION.INPUTS])) {
        componentRef.setInput(key, value);
      }
    }
  }

  private _runDeleteInstruction(command: RenderCommand) {
    const id = getRenderCommandId(command);
    const cached = this._commandCache.get(id);

    if (!cached) {
      if (isHtmlCloseRenderCommand(command)) {
        return;
      }

      console.log({ id, command });

      throw new Error('Cached command not found!');
    }

    if (isComponentRenderCommand(command)) {
      cached.componentRef?.destroy();
    } else if (isTextRenderCommand(command)) {
      this._renderer.removeChild(cached.element?.parentElement, cached.element);
    } else if (isHtmlOpenRenderCommand(command)) {
      this._renderer.removeChild(cached.element?.parentElement, cached.element);
    } else if (isHtmlCloseRenderCommand(command)) {
      // Do nothing
    }

    this._commandCache.delete(id);
  }

  private _getComponentRootNode(componentRef: ComponentRef<any>): HTMLElement {
    return (componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
  }

  private _debugVisualizeRenderCommands(commands: RenderCommand[]) {
    console.log(commands);

    const debug = commands
      .map((command) => {
        const nestAttr = `nest="${command[RENDER_COMMAND_POSITION.NESTING_LEVEL]}"`;
        const domAttr = `dom="${command[RENDER_COMMAND_POSITION.DOM_POSITION]}"`;

        if (isHtmlOpenRenderCommand(command)) {
          return `<${command[HTML_OPEN_RENDER_COMMAND_POSITION.TAG_NAME]} ${nestAttr} ${domAttr}>`;
        } else if (isHtmlCloseRenderCommand(command)) {
          return `</${command[HTML_CLOSE_RENDER_COMMAND_POSITION.TAG_NAME]} ${nestAttr} ${domAttr}>`;
        } else if (isTextRenderCommand(command)) {
          return [`<span ${nestAttr} ${domAttr}>`, command[TEXT_RENDER_COMMAND_POSITION.TEXT], '</span>'];
        } else if (isComponentRenderCommand(command)) {
          const selector = command[COMPONENT_RENDER_COMMAND_POSITION.COMPONENT_TYPE];
          return [`<${selector} ${nestAttr} ${domAttr}>`, `</${selector}>`];
        } else {
          return 'UNKNOWN';
        }
      })
      .flat();

    const prettified = formatHTML(debug);
    console.log(prettified);

    return prettified;
  }
}

function formatHTML(html: string[]) {
  const result: string[] = [];
  let indent = 0;

  for (const tag of html) {
    if (tag.startsWith('</')) {
      indent--;
    }

    result.push(' '.repeat(indent * 2) + tag);

    if (tag.startsWith('<') && !tag.startsWith('</')) {
      indent++;
    }
  }

  return result.join('\n');
}
