import {
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  ElementRef,
  EmbeddedViewRef,
  Type,
  ViewContainerRef,
  ViewEncapsulation,
  WritableSignal,
  computed,
  effect,
  inject,
  input,
  inputBinding,
  isDevMode,
  linkedSignal,
  reflectComponentType,
  signal,
  untracked,
} from '@angular/core';
import { BLOCKS, Block, INLINES, Inline, Mark, Text } from '@contentful/rich-text-types';
import { getObjectProperty, injectRenderer, isObject } from '@ethlete/core';
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

type HtmlOpenRenderCommand = {
  kind: 'htmlOpen';
  nestingLevel: number;
  domPosition: number;
  index: number;
  attributes: Record<string, string>;
  tagName: keyof HTMLElementTagNameMap;
  id: string;
};

type HtmlCloseRenderCommand = {
  kind: 'htmlClose';
  nestingLevel: number;
  domPosition: number;
  index: number;
  tagName: keyof HTMLElementTagNameMap;
  id: string;
};

type TextRenderCommand = {
  kind: 'text';
  nestingLevel: number;
  domPosition: number;
  index: number;
  attributes: Record<string, string>;
  text: string;
  id: string;
};

type ComponentRenderCommand = {
  kind: 'component';
  nestingLevel: number;
  domPosition: number;
  index: number;
  component: Type<unknown>;
  inputs: Record<string, unknown>;
  id: string;
};

type RenderCommand = HtmlOpenRenderCommand | HtmlCloseRenderCommand | TextRenderCommand | ComponentRenderCommand;

type RenderInstruction = {
  type: 'create' | 'update' | 'move' | 'delete';
  command: RenderCommand;
};

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

const CLASS_ATTR = 'class';
const DEFAULT_COMPONENT_TYPES = {
  IMAGE: '$$$_et-image',
  VIDEO: '$$$_et-video',
  AUDIO: '$$$_et-audio',
  FILE: '$$$_et-file',
  LINK: '$$$_et-link',
};

type ExecutedCommandCacheItemBase = {
  element: HTMLElement;
};

type ExecutedComponentCommandCacheItem = {
  command: ComponentRenderCommand;
  componentRef: ComponentRef<unknown>;
  inputs: WritableSignal<Record<string, unknown>>;
} & ExecutedCommandCacheItemBase;

type ExecutedHtmlCommandCacheItem = {
  command: HtmlOpenRenderCommand | HtmlCloseRenderCommand;
} & ExecutedCommandCacheItemBase;

type ExecutedTextCommandCacheItem = {
  command: TextRenderCommand;
} & ExecutedCommandCacheItemBase;

type ExecutedCommandCacheItem =
  ExecutedComponentCommandCacheItem | ExecutedHtmlCommandCacheItem | ExecutedTextCommandCacheItem;

const isExecutedComponentCommandCacheItem = (
  cache: ExecutedCommandCacheItem,
): cache is ExecutedComponentCommandCacheItem => {
  return cache.command.kind === 'component';
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

export type CreateContentfulIncludeMapConfig = {
  /** The entries that should be present inside the map  */
  entries: ContentfulEntry[];

  /** The assets that should be present inside the map  */
  assets: ContentfulRestAsset[];
};

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
  host: {
    class: 'et-contentful-rich-text-renderer',
  },
})
export class ContentfulRichTextRendererComponent {
  private readonly _viewContainerRef = inject(ViewContainerRef);
  private readonly _renderer = injectRenderer();
  private readonly _elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly _config = inject(CONTENTFUL_CONFIG, { optional: true }) ?? createContentfulConfig();

  /**
   * A cache for all executed commands that are not deleted.
   * This is used to keep track of all rendered elements and components.
   * The key is the render command ID.
   */
  private readonly _executedCommandsCache = new Map<string, ExecutedCommandCacheItem>();

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
      throw richTextRendererError('rich_text_undefined', { content, richTextPath });
    }

    if (!isRichTextRootNode(richText)) {
      throw richTextRendererError('rich_text_wrong_type', { content, richTextPath });
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

  private readonly renderCommandHistory = linkedSignal<RenderCommand[], [RenderCommand[], RenderCommand[]]>({
    source: this.renderCommands,
    computation: (commands, previous) => [previous?.source ?? [], commands],
  });

  private readonly previousRenderCommandMap = computed(() => {
    const [prevCommands] = this.renderCommandHistory();

    const map = new Map<string, RenderCommand>();

    for (const command of prevCommands) {
      map.set(command.id, command);
    }

    return map;
  });

  private readonly renderInstructions = computed(() => {
    const commands = this.renderCommands();
    const previousRenderCommandMap = new Map(this.previousRenderCommandMap());

    const instructions: RenderInstruction[] = [];

    // remove deleted components as well as all other elements
    for (const [, command] of previousRenderCommandMap) {
      if (command.kind === 'component') {
        // keep the component around if it's still in the new commands
        if (commands.some((c) => c.id === command.id)) {
          continue;
        }
      }

      instructions.push({ type: 'delete', command });

      // remove from map to mark as used
      previousRenderCommandMap.delete(command.id);
    }

    // Find the indexes of the commands remaining in the previousRenderCommandMap in the new commands array.
    const lastComponentIndexes: { newIndex: number; prevIndex: number; command: RenderCommand }[] = [];
    for (const [id, command] of previousRenderCommandMap) {
      const index = commands.findIndex((c) => c.id === id);
      const newCommand = commands[index];

      if (index === -1 || !newCommand) {
        throw new Error('Command not found!');
      }

      lastComponentIndexes.push({
        newIndex: index,
        prevIndex: command.index,
        command: newCommand,
      });
    }

    lastComponentIndexes.sort((a, b) => a.newIndex - b.newIndex);

    // Every preserved component gets its inputs refreshed. A component whose previous position
    // breaks the ascending order relative to the new order additionally has to be re-inserted.
    let lastPrevIndex = -1;
    for (const item of lastComponentIndexes) {
      if (item.prevIndex < lastPrevIndex) {
        instructions.push({ type: 'move', command: item.command });
      } else {
        lastPrevIndex = item.prevIndex;
        instructions.push({ type: 'update', command: item.command });
      }
    }

    for (const command of commands) {
      if (command.kind === 'component') {
        const previousCommand = previousRenderCommandMap.get(command.id);

        if (!previousCommand) {
          instructions.push({ type: 'create', command });
        }
      } else {
        instructions.push({ type: 'create', command });
      }
    }

    return instructions;
  });

  constructor() {
    effect(() => {
      const instructions = this.renderInstructions();

      untracked(() => this._execInstructions(instructions));
    });
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
          const text = node.value;

          if (!text) break;

          const attributes: Record<string, string> = {
            class: 'et-contentful-rich-text-default-element et-contentful-rich-text-default-span',
          };

          if (node.marks.length) {
            const markClasses = marksToClass(node.marks);

            if (CLASS_ATTR in attributes) {
              attributes[CLASS_ATTR] += ` ${markClasses}`;
            } else {
              attributes[CLASS_ATTR] = markClasses;
            }
          }

          rootCommands.push({
            kind: 'text',
            nestingLevel,
            domPosition,
            index: commandIndex++,
            attributes,
            text,
            id: 't' + textId++,
          });

          domPosition++;

          break;
        }

        case BLOCKS.EMBEDDED_ASSET: {
          const assetId = node.data['target']?.sys?.id;

          if (!assetId) {
            throw richTextRendererError('asset_id_not_found', { node });
          }

          const asset = this.contentIncludesMap().getAsset(assetId);

          if (!asset) {
            throw richTextRendererError('asset_not_found', { assetId, node });
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

          rootCommands.push({
            kind: 'component',
            nestingLevel,
            domPosition,
            index: commandIndex++,
            component,
            inputs: { asset },
            id,
          });

          domPosition++;

          break;
        }

        case INLINES.HYPERLINK: {
          const uri = (node.data['uri'] as string) ?? '';

          // Collect all text and marks from children (hyperlink children are text nodes)
          let linkText = '';
          const linkMarks: Mark[] = [];

          for (const child of node.content) {
            if (child.nodeType === 'text') {
              linkText += child.value;
              linkMarks.push(...child.marks);
            }
          }

          const textClass = linkMarks.length ? marksToClass(linkMarks) : '';

          let linkComponentId = componentIdMap.get(DEFAULT_COMPONENT_TYPES.LINK) ?? -1;
          const linkId = DEFAULT_COMPONENT_TYPES.LINK + ++linkComponentId;
          componentIdMap.set(DEFAULT_COMPONENT_TYPES.LINK, linkComponentId);

          rootCommands.push({
            kind: 'component',
            nestingLevel,
            domPosition,
            index: commandIndex++,
            component: this._config.components.link,
            inputs: { href: uri, text: linkText, textClass },
            id: linkId,
          });

          domPosition++;

          break;
        }

        case BLOCKS.EMBEDDED_ENTRY:
        case INLINES.EMBEDDED_ENTRY: {
          const entryId = node.data['target']?.sys?.id;

          if (!entryId) {
            throw richTextRendererError('entry_id_not_found', { node });
          }

          const entry = this.contentIncludesMap().getEntry(entryId, ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID);

          if (!entry) {
            throw richTextRendererError('entry_not_found', { entryId, node });
          }

          const componentType = entry.sys.contentType.sys.id;

          const component = this._config.customComponents[componentType];

          if (!component) {
            throw richTextRendererError('custom_component_not_found', {
              componentType,
              customComponents: this._config.customComponents,
              entry,
            });
          }

          let componentId = componentIdMap.get(componentType) ?? -1;
          const id = componentType + ++componentId;
          componentIdMap.set(componentType, componentId);

          rootCommands.push({
            kind: 'component',
            nestingLevel,
            domPosition,
            index: commandIndex++,
            component,
            inputs: {
              fields: entry.fields,
              metadata: entry.metadata,
              sys: entry.sys,
              includes: this.contentIncludesMap(),
            },
            id,
          });

          domPosition++;

          break;
        }

        default: {
          const tag = translateContentfulNodeTypeToHtmlTag(node.nodeType);
          const attributes: Record<string, string> = {
            class: `et-contentful-rich-text-default-element et-contentful-rich-text-default-${tag}`,
          };

          rootCommands.push({
            kind: 'htmlOpen',
            nestingLevel,
            domPosition,
            index: commandIndex++,
            attributes,
            tagName: tag,
            id: 'e-o' + elementOpenId++,
          });

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

          if (lastCommand?.kind === 'htmlOpen' && lastCommand.tagName !== 'td' && lastCommand.tagName !== 'hr') {
            // If the last command is an open command, we can remove it since it's empty
            rootCommands.pop();
            elementOpenId--;
            commandIndex--;
          } else {
            rootCommands.push({
              kind: 'htmlClose',
              nestingLevel,
              domPosition,
              index: commandIndex++,
              tagName: tag,
              id: 'e-c' + elementCloseId++,
            });

            domPosition++;
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
      switch (instruction.type) {
        case 'create':
          this._runCreateInstruction(instruction.command);
          break;
        case 'update':
          this._runUpdateInstruction(instruction.command);
          break;
        case 'move':
          this._runMoveInstruction(instruction.command);
          break;
        case 'delete':
          this._runDeleteInstruction(instruction.command);
          break;
      }
    }
  }

  private _runCreateInstruction(command: RenderCommand) {
    const parentElement = this._findParent(command);
    const nextElement = this._findFollowingElement(command);

    if (command.kind === 'component') {
      const inputs = signal(command.inputs);

      // Components may declare any subset of the offered inputs — only bind the declared ones.
      const declaredInputs = reflectComponentType(command.component)?.inputs ?? [];
      const bindings = declaredInputs
        .filter((declared) => declared.propName in command.inputs)
        .map((declared) => inputBinding(declared.templateName, () => inputs()[declared.propName]));

      const componentRef = this._viewContainerRef.createComponent(command.component, { bindings });

      const rootNode = this._getComponentRootNode(componentRef);

      this._renderInsertOrAppend(rootNode, parentElement, nextElement);

      this._executedCommandsCache.set(command.id, {
        command,
        componentRef,
        inputs,
        element: rootNode,
      });
    } else if (command.kind === 'text') {
      const span = this._renderer.createElement('span');
      const textSplitInLineBreaks = command.text.split('\n').filter((t) => t.trim().length > 0);

      for (const [key, value] of Object.entries(command.attributes)) {
        this._renderer.setAttribute(span, key, value);
      }

      if (command.text.startsWith('\n')) {
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
      }

      this._renderInsertOrAppend(span, parentElement, nextElement);

      this._executedCommandsCache.set(command.id, {
        command,
        element: span,
      });
    } else if (command.kind === 'htmlOpen') {
      const element = this._renderer.createElement(command.tagName);

      for (const [key, value] of Object.entries(command.attributes)) {
        this._renderer.setAttribute(element, key, value);
      }

      this._renderInsertOrAppend(element, parentElement, nextElement);

      this._executedCommandsCache.set(command.id, {
        command,
        element,
      });
    }
  }

  private _runUpdateInstruction(command: RenderCommand) {
    const cached = this._executedCommandsCache.get(command.id);

    if (!cached) {
      throw new Error('Cached command not found!');
    }

    if (command.kind === 'component') {
      if (!isExecutedComponentCommandCacheItem(cached)) {
        throw new Error('Cached command is not a component command!');
      }

      cached.inputs.set(command.inputs);
    }

    // `cached` and the fresh `command` share the same id and therefore the same union variant,
    // but TS can't correlate the two after the spread — assert the merged object as the union.
    this._executedCommandsCache.set(command.id, {
      ...cached,
      command,
    } as ExecutedCommandCacheItem);
  }

  private _runMoveInstruction(command: RenderCommand) {
    const cached = this._executedCommandsCache.get(command.id);

    if (!cached) {
      throw new Error('Cached command not found!');
    }

    if (command.kind === 'component') {
      if (!isExecutedComponentCommandCacheItem(cached)) {
        throw new Error('Cached command is not a component command!');
      }

      const rootNode = cached.element;
      const oldParentElement = cached.element.parentElement;

      if (oldParentElement) {
        this._renderer.removeChild(oldParentElement, rootNode);
      }

      const newParentElement = this._findParent(command);
      const nextElement = this._findFollowingElement(command);

      this._renderInsertOrAppend(rootNode, newParentElement, nextElement);

      cached.inputs.set(command.inputs);

      this._executedCommandsCache.set(command.id, {
        ...cached,
        command,
      } as ExecutedCommandCacheItem);
    }
  }

  private _runDeleteInstruction(command: RenderCommand) {
    const cached = this._executedCommandsCache.get(command.id);

    if (!cached) {
      if (command.kind === 'htmlClose') {
        return;
      }

      throw new Error('Cached command not found!');
    }

    if (command.kind === 'component') {
      if (!isExecutedComponentCommandCacheItem(cached)) {
        throw new Error('Cached command is not a component command!');
      }

      cached.componentRef.destroy();
    } else if (command.kind === 'text' || command.kind === 'htmlOpen') {
      if (cached.element.parentElement) {
        this._renderer.removeChild(cached.element.parentElement, cached.element);
      }
    }

    this._executedCommandsCache.delete(command.id);
  }

  private _getComponentRootNode(componentRef: ComponentRef<unknown>): HTMLElement {
    return (componentRef.hostView as EmbeddedViewRef<unknown>).rootNodes[0] as HTMLElement;
  }

  private _findParent(command: RenderCommand) {
    const hostElement = this._elementRef.nativeElement;
    let parentElement: HTMLElement | undefined;

    if (command.nestingLevel === 0) {
      parentElement = hostElement;
    } else {
      // Reverse search all render commands beginning from the current one.
      // The parent is the closest preceding html open command one nesting level up.
      const allCommands = this.renderCommands();

      let parentCommand: HtmlOpenRenderCommand | null = null;

      for (let i = command.index - 1; i >= 0; i--) {
        const cmd = allCommands[i];

        if (!cmd) {
          throw new Error('Command not found!');
        }

        if (cmd.nestingLevel === command.nestingLevel - 1 && cmd.kind === 'htmlOpen') {
          parentCommand = cmd;
          break;
        }
      }

      if (!parentCommand) {
        throw new Error('Parent command not found!');
      }

      parentElement = this._executedCommandsCache.get(parentCommand.id)?.element;
    }

    if (!parentElement) {
      throw new Error('Parent element not found!');
    }

    return parentElement;
  }

  private _findFollowingElement(command: RenderCommand) {
    // Find an already rendered element at the same nesting level with a greater domPosition,
    // to insert before. Without one the element is appended to the parent.
    for (const cached of this._executedCommandsCache.values()) {
      if (
        cached.command.domPosition > command.domPosition &&
        cached.command.nestingLevel === command.nestingLevel &&
        // Make sure the element does not find itself
        cached.command.kind !== command.kind
      ) {
        return cached.element;
      }
    }

    return undefined;
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
