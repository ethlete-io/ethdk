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
  inject,
  input,
  isDevMode,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { BLOCKS, Block, INLINES, Inline, Mark, Text } from '@contentful/rich-text-types';
import { getObjectProperty, isObject } from '@ethlete/core';
import { pairwise, startWith, tap } from 'rxjs';
import { CONTENTFUL_CONFIG } from '../../constants/contentful.constants';
import {
  ContentfulCollection,
  ContentfulEntry,
  ContentfulEntryLinkItem,
  ContentfulRestAsset,
  RichTextResponse,
} from '../../types';
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
  INDEX: 3,
} as const;

export const HTML_OPEN_RENDER_COMMAND_POSITION = {
  ATTRIBUTES: 4,
  TAG_NAME: 5,
  ELEMENT_ID: 6,
} as const;

export const HTML_CLOSE_RENDER_COMMAND_POSITION = {
  TAG_NAME: 4,
  ELEMENT_ID: 5,
} as const;

export const TEXT_RENDER_COMMAND_POSITION = {
  ATTRIBUTES: 4,
  TEXT: 5,
  TEXT_ID: 6,
} as const;

export const COMPONENT_RENDER_COMMAND_POSITION = {
  ATTRIBUTES: 4,
  COMPONENT: 5,
  INPUTS: 6,
  COMPONENT_ID: 7,
} as const;

type HtmlOpenRenderCommand = [
  type: typeof RENDER_COMMAND_TYPE.HTML_OPEN,
  nestingLevel: number,
  domPosition: number,
  index: number,
  attributes: Record<string, string>,
  tagName: string,
  textId: string,
];

type HtmlCloseRenderCommand = [
  type: typeof RENDER_COMMAND_TYPE.HTML_CLOSE,
  nestingLevel: number,
  domPosition: number,
  index: number,
  tagName: string,
  elementId: string,
];

type TextRenderCommand = [
  type: typeof RENDER_COMMAND_TYPE.TEXT,
  nestingLevel: number,
  domPosition: number,
  index: number,
  attributes: Record<string, string>,
  text: string,
  elementId: string,
];

type ComponentRenderCommand = [
  type: typeof RENDER_COMMAND_TYPE.COMPONENT,
  nestingLevel: number,
  domPosition: number,
  index: number,
  attributes: Record<string, string>,
  component: ComponentType<unknown>,
  inputs: Record<string, unknown>,
  componentId: string,
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
  MOVE: 3,
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
    return command[TEXT_RENDER_COMMAND_POSITION.TEXT_ID];
  } else {
    return command[COMPONENT_RENDER_COMMAND_POSITION.COMPONENT_ID];
  }
};

const CLASS_ATTR = 'class';
const DEFAULT_COMPONENT_TYPES = {
  IMAGE: '$$$_et-image',
  VIDEO: '$$$_et-video',
  AUDIO: '$$$_et-audio',
  FILE: '$$$_et-file',
};

type ExecutedCommandCacheItemBase = {
  element: HTMLElement;
};

type ExecutedComponentCommandCacheItem = {
  command: ComponentRenderCommand;
  componentRef: ComponentRef<unknown>;
} & ExecutedCommandCacheItemBase;

type ExecutedHtmlCommandCacheItem = {
  command: HtmlOpenRenderCommand | HtmlCloseRenderCommand;
} & ExecutedCommandCacheItemBase;

type ExecutedTextCommandCacheItem = {
  command: TextRenderCommand;
  textNode: unknown;
} & ExecutedCommandCacheItemBase;

type ExecutedCommandCacheItem =
  | ExecutedComponentCommandCacheItem
  | ExecutedHtmlCommandCacheItem
  | ExecutedTextCommandCacheItem;

export const isExecutedComponentCommandCacheItem = (
  cache: ExecutedCommandCacheItem,
): cache is ExecutedComponentCommandCacheItem => {
  return isComponentRenderCommand(cache.command);
};

export const isExecutedHtmlOrTextCommandCacheItem = (
  cache: ExecutedCommandCacheItem,
): cache is ExecutedHtmlCommandCacheItem => {
  return isHtmlCloseRenderCommand(cache.command) || isHtmlOpenRenderCommand(cache.command);
};

export const isExecutedTextCommandCacheItem = (
  cache: ExecutedCommandCacheItem,
): cache is ExecutedTextCommandCacheItem => {
  return isTextRenderCommand(cache.command);
};

export const ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID = '$$$_et-contentful-any-entry-content-type-sys-id';

export type ContentfulIncludeMap = {
  /**
   * Select an entry by its ID and content type ID.
   *
   * The content type ID can be found inside the entry -> sys -> contentType -> sys -> id property.
   *
   * You can provide the `ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID` constant to match any entry sys ID.
   * But be aware that this will return the entry as is without any type checking.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getEntry: <T extends { [key: string]: any }>(id: string, contentTypeId: string) => ContentfulEntry<T> | null;

  /**
   * Select multiple entries by their IDs and content type ID.
   * If an entry is not found, it will be omitted from the result.
   *
   * The content type ID can be found inside the entry -> sys -> contentType -> sys -> id property.
   *
   * You can provide the `ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID` constant to match any entry sys ID.
   * But be aware that this will return the entry as is without any type checking.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getEntries: <T extends { [key: string]: any }>(
    ids: string[] | ContentfulEntryLinkItem[],
    contentTypeId: string,
  ) => ContentfulEntry<T>[];

  /**
   * Select an asset by its ID.
   */
  getAsset: (id: string) => ContentfulRestAsset | null;

  /**
   * Select multiple assets by their IDs. If an asset is not found, it will be omitted from the result.
   */
  getAssets: (ids: string[]) => ContentfulRestAsset[];
};

export interface CreateContentfulIncludeMapConfig {
  /** The entries that should be present inside the map  */
  entries: ContentfulEntry[];

  /** The assets that should be present inside the map  */
  assets: ContentfulRestAsset[];
}

/**
 * Create a contentful include map using the provided entries and assets.
 */
export const createContentfulIncludeMap = (config: CreateContentfulIncludeMapConfig): ContentfulIncludeMap => {
  const { entries, assets } = config;

  const assetMap = new Map(assets.map((asset) => [asset.sys.id, asset]));
  const entryMap = new Map(entries.map((entry) => [entry.sys.id, entry]));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getEntry = <T extends { [key: string]: any }>(id: string, contentTypeId: string) => {
    const entry = entryMap.get(id);

    if (!entry) {
      if (isDevMode()) {
        console.warn('Entry not found! Will return null. Is the include query param to low?', { id, entryMap });
      }

      return null;
    }

    if (contentTypeId === ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID) {
      return entry as ContentfulEntry<T>;
    }

    if (entry.sys.contentType.sys.id !== contentTypeId) {
      if (isDevMode()) {
        console.warn('Entry sys ID does not match the provided sys ID! Will return null.', {
          entry,
          sysId: contentTypeId,
        });
      }

      return null;
    }

    return entry as ContentfulEntry<T>;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getEntries = <T extends { [key: string]: any }>(
    ids: string[] | ContentfulEntryLinkItem[],
    contentTypeId: string,
  ) => {
    const entries = ids
      .map((id) => (typeof id === 'string' ? id : id.sys.id))
      .map((id) => getEntry<T>(id, contentTypeId))
      .filter((entry): entry is ContentfulEntry<T> => entry !== null);

    return entries;
  };

  const getAsset = (id: string) => {
    return assetMap.get(id) ?? null;
  };

  const getAssets = (ids: string[]) => {
    return ids.map((id) => getAsset(id)).filter((asset): asset is ContentfulRestAsset => asset !== null);
  };

  return {
    getEntry,
    getEntries,
    getAsset,
    getAssets,
  };
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
  _viewContainerRef = inject(ViewContainerRef);
  _renderer = inject(Renderer2);
  _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  _document = inject(DOCUMENT);
  _config = inject(CONTENTFUL_CONFIG, { optional: true }) ?? createContentfulConfig();

  /**
   * A cache for all executed commands that are not deleted.
   * This is used to keep track of all rendered elements and components.
   * The key is the render command element ID.
   */
  _executedCommandsCache = new Map<string, ExecutedCommandCacheItem>();

  /**
   * The contentful response gotten via their REST api.
   * @see https://www.contentful.com/developers/docs/references/content-delivery-api/#/reference/entries/entries-collection
   */
  content = input.required<ContentfulCollection | null | undefined>();

  /**
   * The path to where the rich text field is inside the contentful response. Dot and array notation is allowed.
   * @example "items[0].fields.html"
   */
  richTextPath = input.required<string>();

  /**
   * A map of all includes in the contentful response.
   * This is useful for looking up assets and entries that are referenced in the rich text without having to use loops.
   */
  contentIncludesMap = computed<ContentfulIncludeMap>(() => {
    const content = this.content();
    const assets = content?.includes.Asset;
    const entries = content?.includes.Entry;

    return createContentfulIncludeMap({ assets: assets ?? [], entries: entries ?? [] });
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

    return richText as RichTextResponse;
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

    // Find the indexes of the commands remaining in the previousRenderCommandMap in the new commands array.
    const lastComponentIndexes: { newIndex: number; prevIndex: number; command: RenderCommand }[] = [];
    for (const [id, command] of previousRenderCommandMap) {
      const index = commands.findIndex((c) => getRenderCommandId(c) === id);
      const newCommand = commands[index]!;

      if (index === -1) {
        throw new Error('Command not found!');
      }

      lastComponentIndexes.push({
        newIndex: index,
        prevIndex: command[RENDER_COMMAND_POSITION.INDEX],
        command: newCommand,
      });
    }

    lastComponentIndexes.sort((a, b) => a.newIndex - b.newIndex);

    // check if the prevIndex are in order ascending
    // for indexes that are not in order, create a move instruction
    // for indexes that are in order, create an update instruction
    let moveCheckIndex = 0;
    while (moveCheckIndex < lastComponentIndexes.length - 1) {
      const moveCurr = lastComponentIndexes[moveCheckIndex];
      const moveNext = lastComponentIndexes[moveCheckIndex + 1];

      if (!moveCurr || !moveNext) {
        break;
      }

      if (moveCurr.prevIndex > moveNext.prevIndex) {
        lastComponentIndexes.splice(moveCheckIndex + 1, 1);
        instructions.push([RENDER_INSTRUCTION_TYPE.MOVE, moveNext.command]);
      } else {
        instructions.push([RENDER_INSTRUCTION_TYPE.UPDATE, moveNext.command]);
        moveCheckIndex++;
      }
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

  constructor() {
    toObservable(this.renderInstructions)
      .pipe(
        takeUntilDestroyed(),
        tap((instructions) => {
          this._execInstructions(instructions);
        }),
      )
      .subscribe();
  }

  private _createRenderCommands(richTextData: RichTextResponse) {
    /** List of all render commands */
    const rootCommands: RenderCommand[] = [];

    /** Counter for generating unique html element IDs. */
    let elementOpenId = 0;

    /** Counter for generating unique html element IDs. */
    let elementCloseId = 0;

    /** Counter for generating unique component IDs. */
    const componentIdMap = new Map<string, number>();

    /** The nesting level of the current node. */
    let nestingLevel = 0;

    /** The position (index) of the current node inside the parent node. */
    let domPosition = 0;

    let textId = 0;

    let commandIndex = 0;

    const traverse = (node: Block | Inline | Text) => {
      switch (node.nodeType) {
        case 'text': {
          // Render media
          const type = RENDER_COMMAND_TYPE.TEXT;
          const text = node.value;

          if (!text) break;

          const attributes: Record<string, string> = {};

          if (node.marks.length) {
            const markClasses = marksToClass(node.marks);

            if (CLASS_ATTR in attributes) {
              attributes[CLASS_ATTR] += ` ${markClasses}`;
            } else {
              attributes[CLASS_ATTR] = markClasses;
            }
          }

          const id = 't' + textId++;

          const command: TextRenderCommand = [type, nestingLevel, domPosition, commandIndex++, attributes, text, id];

          rootCommands.push(command);
          domPosition++;

          break;
        }

        case BLOCKS.EMBEDDED_ASSET: {
          // Render media
          const type = RENDER_COMMAND_TYPE.COMPONENT;
          const assetId = node.data['target']?.sys?.id;

          if (!assetId) {
            throw richTextRendererError('asset_id_not_found', false, { node });
          }

          const asset = this.contentIncludesMap().getAsset(assetId);

          if (!asset) {
            throw richTextRendererError('asset_not_found', false, { assetId, node });
          }

          const contentType = asset.fields.file.contentType;
          const assetComponents = this._config.components;

          // Every property inside the asset will be null if no file was provided for a translation.
          // In this case, we can assume that the asset is missing due to user error.
          const isMissing = !contentType && !asset.fields.file.url;

          if (isMissing) {
            if (isDevMode()) {
              console.warn(
                'Asset is missing file data! Asset will be skipped. Did you forget to upload a file for the current translation in Contentful?',
                { asset },
              );
            }

            break;
          }

          const isImage = contentType?.startsWith('image/');
          const isVideo = contentType?.startsWith('video/');
          const isAudio = contentType?.startsWith('audio/');

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

          let componentId = componentIdMap.get(componentType) ?? -1;
          const id = componentType + ++componentId;
          componentIdMap.set(componentType, componentId);

          const attributes = {};

          const inputs = {
            asset,
          };

          const command: ComponentRenderCommand = [
            type,
            nestingLevel,
            domPosition,
            commandIndex++,
            attributes,
            component,
            inputs,
            id,
          ];

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

          const entry = this.contentIncludesMap().getEntry(entryId, ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID);

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
          let componentId = componentIdMap.get(componentType) ?? -1;
          const id = componentType + ++componentId;
          componentIdMap.set(componentType, componentId);

          const inputs = {
            fields: entry.fields,
            metadata: entry.metadata,
            sys: entry.sys,
            includes: this.contentIncludesMap(),
          };

          const command: ComponentRenderCommand = [
            type,
            nestingLevel,
            domPosition,
            commandIndex++,
            attributes,
            component,
            inputs,
            id,
          ];

          rootCommands.push(command);

          domPosition++;

          break;
        }

        default: {
          const type = RENDER_COMMAND_TYPE.HTML_OPEN;
          const tag = translateContentfulNodeTypeToHtmlTag(node.nodeType);
          const attributes: Record<string, string> = {};
          const id = 'e-o' + elementOpenId++;

          const command: HtmlOpenRenderCommand = [type, nestingLevel, domPosition, commandIndex++, attributes, tag, id];

          rootCommands.push(command);

          const domPositionAtThisLevel = domPosition;
          // Normal html elements can have children
          for (const child of node.content) {
            domPosition = 0;
            nestingLevel++;
            traverse(child);
            nestingLevel--;
            domPosition = domPositionAtThisLevel;
          }

          const lastCommand = rootCommands[rootCommands.length - 1];

          if (
            lastCommand?.[RENDER_COMMAND_POSITION.TYPE] === RENDER_COMMAND_TYPE.HTML_OPEN &&
            lastCommand[HTML_OPEN_RENDER_COMMAND_POSITION.TAG_NAME] !== 'td' &&
            lastCommand[HTML_OPEN_RENDER_COMMAND_POSITION.TAG_NAME] !== 'hr'
          ) {
            // If the last command is an open command, we can remove it since it's empty
            rootCommands.pop();
            elementOpenId--;
            commandIndex--;
          } else {
            const closeId = 'e-c' + elementCloseId++;

            const closeCommand: HtmlCloseRenderCommand = [
              RENDER_COMMAND_TYPE.HTML_CLOSE,
              nestingLevel,
              domPosition,
              commandIndex++,
              tag,
              closeId,
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
      traverse(node);
    }

    return rootCommands;
  }

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
        case RENDER_INSTRUCTION_TYPE.MOVE:
          this._runMoveInstruction(command);
          break;
        case RENDER_INSTRUCTION_TYPE.DELETE:
          this._runDeleteInstruction(command);
          break;
      }
    }
  }

  private _runCreateInstruction(command: RenderCommand) {
    const id = getRenderCommandId(command);
    const parentElement = this._findParent(command);
    const nextElement = this._findFollowingElement(command);

    if (isComponentRenderCommand(command)) {
      const componentRef = this._viewContainerRef.createComponent(command[COMPONENT_RENDER_COMMAND_POSITION.COMPONENT]);

      this._updateComponentInputs(command, componentRef);

      const rootNode = this._getComponentRootNode(componentRef);

      this._renderInsertOrAppend(rootNode, parentElement, nextElement);

      this._executedCommandsCache.set(id, {
        command,
        componentRef,
        element: rootNode,
      });
    } else if (isTextRenderCommand(command)) {
      const text = command[TEXT_RENDER_COMMAND_POSITION.TEXT];
      const span = this._renderer.createElement('span');
      const attributes = command[TEXT_RENDER_COMMAND_POSITION.ATTRIBUTES];
      const textSplitInLineBreaks = text.split('\n').filter((t) => t.trim().length > 0);

      const textNodes: unknown[] = [];

      for (const [key, value] of Object.entries(attributes)) {
        this._renderer.setAttribute(span, key, value);
      }

      if (text.startsWith('\n')) {
        const brNode = this._renderer.createElement('br');
        this._renderer.appendChild(parentElement, brNode);
      }

      for (const [textPartIndex, textPart] of textSplitInLineBreaks.entries()) {
        if (textPartIndex > 0) {
          const brNode = this._renderer.createElement('br');
          this._renderer.appendChild(span, brNode);
        }

        const textNode = this._renderer.createText(textPart);

        this._renderer.appendChild(span, textNode);

        textNodes.push(textNode);
      }

      this._renderInsertOrAppend(span, parentElement, nextElement);

      this._executedCommandsCache.set(id, {
        command,
        element: span,
        textNode: textNodes,
      });
    } else if (isHtmlOpenRenderCommand(command)) {
      const tag = command[HTML_OPEN_RENDER_COMMAND_POSITION.TAG_NAME];
      const attributes = command[HTML_OPEN_RENDER_COMMAND_POSITION.ATTRIBUTES];
      const element = this._renderer.createElement(tag);

      for (const [key, value] of Object.entries(attributes)) {
        this._renderer.setAttribute(element, key, value);
      }

      this._renderInsertOrAppend(element, parentElement, nextElement);

      this._executedCommandsCache.set(id, {
        command,
        element,
      });
    }
  }

  private _runUpdateInstruction(command: RenderCommand) {
    const id = getRenderCommandId(command);
    const cached = this._executedCommandsCache.get(id);

    if (!cached) {
      throw new Error('Cached command not found!');
    }

    if (isComponentRenderCommand(command)) {
      if (!isExecutedComponentCommandCacheItem(cached)) {
        throw new Error('Cached command is not a component command!');
      }

      const componentRef = cached.componentRef;

      if (!componentRef) {
        throw new Error('Component ref not found!');
      }

      this._updateComponentInputs(command, componentRef);
    }

    this._executedCommandsCache.set(id, {
      ...cached,
      command: command as any,
    });
  }

  private _runMoveInstruction(command: RenderCommand) {
    const id = getRenderCommandId(command);
    const cached = this._executedCommandsCache.get(id);

    if (!cached) {
      throw new Error('Cached command not found!');
    }

    if (isComponentRenderCommand(command)) {
      if (!isExecutedComponentCommandCacheItem(cached)) {
        throw new Error('Cached command is not a component command!');
      }

      const componentRef = cached.componentRef;

      if (!componentRef) {
        throw new Error('Component ref not found!');
      }

      const rootNode = cached.element;
      const oldParentElement = cached.element.parentElement;

      this._renderer.removeChild(oldParentElement, rootNode);

      const newParentElement = this._findParent(command);
      const nextElement = this._findFollowingElement(command);

      this._renderInsertOrAppend(rootNode, newParentElement, nextElement);

      this._updateComponentInputs(command, componentRef);

      this._executedCommandsCache.set(id, {
        ...cached,
        command: command as any,
      });
    }
  }

  private _runDeleteInstruction(command: RenderCommand) {
    const id = getRenderCommandId(command);
    const cached = this._executedCommandsCache.get(id);

    if (!cached) {
      if (isHtmlCloseRenderCommand(command)) {
        return;
      }

      throw new Error('Cached command not found!');
    }

    if (isComponentRenderCommand(command)) {
      if (!isExecutedComponentCommandCacheItem(cached)) {
        throw new Error('Cached command is not a component command!');
      }

      cached.componentRef?.destroy();
    } else if (isTextRenderCommand(command)) {
      this._renderer.removeChild(cached.element?.parentElement, cached.element);
    } else if (isHtmlOpenRenderCommand(command)) {
      this._renderer.removeChild(cached.element?.parentElement, cached.element);
    }

    this._executedCommandsCache.delete(id);
  }

  private _getComponentRootNode(componentRef: ComponentRef<any>): HTMLElement {
    return (componentRef.hostView as EmbeddedViewRef<any>).rootNodes[0] as HTMLElement;
  }

  private _updateComponentInputs(command: ComponentRenderCommand, componentRef: ComponentRef<any>) {
    for (const [key, value] of Object.entries(command[COMPONENT_RENDER_COMMAND_POSITION.INPUTS])) {
      if (!componentRef.instance[key]) continue;

      componentRef.setInput(key, value);
    }
  }

  private _findParent(command: RenderCommand) {
    const hostElement = this._elementRef.nativeElement;
    const nestingLevel = command[RENDER_COMMAND_POSITION.NESTING_LEVEL];
    let parentElement: HTMLElement | undefined = undefined;

    if (nestingLevel === 0) {
      parentElement = hostElement;
    } else {
      // Reverse search all render commands beginning from the current one using a for loop.
      // The parent is found when the command's nesting level ist the same as the current nesting level minus 1.
      // If the parent is not found, throw an error.
      const allCommands = this.renderCommands();
      const currentCommandIndex = command[RENDER_COMMAND_POSITION.INDEX];

      let parentCommand: RenderCommand | null = null;

      for (let i = currentCommandIndex - 1; i >= 0; i--) {
        const cmd = allCommands[i];

        if (!cmd) {
          throw new Error('Command not found!');
        }

        if (cmd[RENDER_COMMAND_POSITION.NESTING_LEVEL] === nestingLevel - 1 && isHtmlOpenRenderCommand(cmd)) {
          parentCommand = cmd;
          break;
        }
      }

      if (!parentCommand) {
        throw new Error('Parent command not found!');
      }

      parentElement = this._executedCommandsCache.get(getRenderCommandId(parentCommand))?.element;
    }

    if (!parentElement) {
      throw new Error('Parent element not found!');
    }

    return parentElement;
  }

  private _findFollowingElement(command: RenderCommand) {
    const cacheArray = Array.from(this._executedCommandsCache.values());
    let nextElement: HTMLElement | undefined = undefined;

    const domPosition = command[RENDER_COMMAND_POSITION.DOM_POSITION];
    const nestingLevel = command[RENDER_COMMAND_POSITION.NESTING_LEVEL];
    const type = command[RENDER_COMMAND_POSITION.TYPE];

    // Try to find an already rendered element with a domPosition that is greater than the current domPosition. If there are multiple, use the one with the smallest domPosition.
    // If it does not exist, use .appendChild to simply append the element to the end of the parent element.
    // If it does exist, use .insertBefore to insert the element before the found element.
    for (const cached of cacheArray) {
      if (
        cached.command[RENDER_COMMAND_POSITION.DOM_POSITION] > domPosition &&
        cached.command[RENDER_COMMAND_POSITION.NESTING_LEVEL] === nestingLevel &&
        // Make sure the element does not find itself
        cached.command[RENDER_COMMAND_POSITION.TYPE] !== type
      ) {
        nextElement = cached.element;
        break;
      }
    }

    return nextElement;
  }

  private _renderInsertOrAppend(
    nodeToRender: HTMLElement,
    parentElement: HTMLElement,
    nextElement: HTMLElement | undefined,
  ) {
    if (nextElement) {
      this._renderer.insertBefore(parentElement, nodeToRender, nextElement);
    } else {
      this._renderer.appendChild(parentElement, nodeToRender);
    }
  }
}

// const stringifyRenderCommand = (command: RenderCommand) => {
//   const nestAttr = `nest="${command[RENDER_COMMAND_POSITION.NESTING_LEVEL]}"`;
//   const domAttr = `dom="${command[RENDER_COMMAND_POSITION.DOM_POSITION]}"`;

//   if (isHtmlOpenRenderCommand(command)) {
//     return `<${command[HTML_OPEN_RENDER_COMMAND_POSITION.TAG_NAME]} ${nestAttr} ${domAttr} _id="${command[HTML_OPEN_RENDER_COMMAND_POSITION.ELEMENT_ID]}" _index="${command[RENDER_COMMAND_POSITION.INDEX]}">`;
//   } else if (isHtmlCloseRenderCommand(command)) {
//     return `</${command[HTML_CLOSE_RENDER_COMMAND_POSITION.TAG_NAME]} ${nestAttr} ${domAttr}>`;
//   } else if (isTextRenderCommand(command)) {
//     let text = command[TEXT_RENDER_COMMAND_POSITION.TEXT];
//     const brStart = text.startsWith('\n') ? '<br/>' : '';
//     text = brStart ? text.slice(1) : text;

//     return [
//       ...(brStart ? [brStart] : []),
//       `<span ${nestAttr} ${domAttr} _index="${command[RENDER_COMMAND_POSITION.INDEX]}">`,
//       text.replace(/\n/g, ' <br/> '),
//       '</span>',
//     ];
//   } else if (isComponentRenderCommand(command)) {
//     const selector = command[COMPONENT_RENDER_COMMAND_POSITION.COMPONENT_ID];
//     return [`<${selector} ${nestAttr} ${domAttr}>`, `</${selector}>`];
//   } else {
//     return 'UNKNOWN';
//   }
// };

// const formatHTMLStringArray = (html: string[]) => {
//   const result: string[] = [];
//   let indent = 0;

//   for (const tag of html) {
//     if (tag.startsWith('</')) {
//       indent--;
//     }

//     result.push(' '.repeat(indent * 2) + tag);

//     if (tag.startsWith('<') && !tag.startsWith('</') && !tag.startsWith('<br')) {
//       indent++;
//     }
//   }

//   return result.join('\n');
// };

// const debugVisualizeRenderCommands = (commands: RenderCommand[]) => {
//   const debug = commands.map((command) => stringifyRenderCommand(command)).flat();

//   const prettified = formatHTMLStringArray(debug);

//   return prettified;
// };

// const stringifyRenderInstruction = (instruction: RenderInstruction) => {
//   const type = instruction[RENDER_INSTRUCTION_POSITION.TYPE];
//   const translatedType = Object.entries(RENDER_INSTRUCTION_TYPE).find(([, value]) => value === type)?.[0];

//   const command = stringifyRenderCommand(instruction[RENDER_INSTRUCTION_POSITION.COMMAND]);

//   return `${translatedType}: ${command}`;
// };
