import {
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
import { Block, Inline, Mark, Text } from '@contentful/rich-text-types';
import { getObjectProperty, injectRenderer, isObject } from '@ethlete/core';
import {
  ContentfulCollection,
  ContentfulEntry,
  ContentfulEntryLinkItem,
  ContentfulRestAsset,
  RichTextResponse,
} from '../../types';
import { injectContentfulConfig } from '../../utils/contentful-config';
import { CF_BLOCKS, CF_INLINES } from './rich-text-node-types';
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
  markTags: MarkTagName[];
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

type MarkTagName = 'strong' | 'em' | 'u' | 'code' | 's' | 'sub' | 'sup';

const MARK_TAG_MAP: Record<string, MarkTagName> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  code: 'code',
  strikethrough: 's',
  subscript: 'sub',
  superscript: 'sup',
};

/**
 * Translates contentful text marks into the semantic html elements the marked text is
 * wrapped in, outermost first. Unknown marks are skipped (with a dev-mode warning).
 */
export const marksToTags = (marks: Mark[]) => {
  const tags: MarkTagName[] = [];

  for (const mark of marks) {
    const tag = MARK_TAG_MAP[mark.type];

    if (!tag) {
      if (isDevMode()) {
        console.warn(`No element found for mark type "${mark.type}"! The mark is ignored.`, mark);
      }

      continue;
    }

    tags.push(tag);
  }

  return tags;
};

/**
 * The classes marked text inside a hyperlink is rendered with, since the link component
 * receives its text as a plain string.
 */
export const marksToClass = (marks: Mark[]) =>
  marks.map((mark) => `et-contentful-rich-text-mark-${mark.type}`).join(' ');

const LINK_COMPONENT_TYPE = '$$$_et-link';

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
  host: {
    class: 'et-contentful-rich-text-renderer',
  },
})
export class ContentfulRichTextRendererComponent {
  private viewContainerRef = inject(ViewContainerRef);
  private readonly renderer = injectRenderer();
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly config = injectContentfulConfig();

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
   * A cache for all executed commands that are not deleted.
   * This is used to keep track of all rendered elements and components.
   * The key is the render command ID.
   */
  private readonly executedCommandsCache = new Map<string, ExecutedCommandCacheItem>();

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

    return this.createRenderCommands(richTextData);
  });

  private renderCommandHistory = linkedSignal<RenderCommand[], [RenderCommand[], RenderCommand[]]>({
    source: this.renderCommands,
    computation: (commands, previous) => [previous?.source ?? [], commands],
  });

  private previousRenderCommandMap = computed(() => {
    const [prevCommands] = this.renderCommandHistory();

    const map = new Map<string, RenderCommand>();

    for (const command of prevCommands) {
      map.set(command.id, command);
    }

    return map;
  });

  private renderInstructions = computed(() => {
    const commands = this.renderCommands();
    const previousRenderCommandMap = this.previousRenderCommandMap();

    const instructions: RenderInstruction[] = [];

    // Decide, in document order, which commands survive the change with their DOM intact.
    // A plain element or text node survives when the same id renders the same output at the same
    // spot inside a surviving parent. Ancestors are decided first because parents precede their
    // children in command order. Components survive on id alone — their DOM can be reattached.
    const preserved = new Set<string>();
    const needsReattach = new Set<string>();

    const parentIdOf = (command: RenderCommand): string | null => {
      if (command.nestingLevel === 0) {
        return null;
      }

      for (let i = command.index - 1; i >= 0; i--) {
        const cmd = commands[i];

        if (cmd && cmd.nestingLevel === command.nestingLevel - 1 && cmd.kind === 'htmlOpen') {
          return cmd.id;
        }
      }

      return null;
    };

    const markTagsEqual = (a: MarkTagName[], b: MarkTagName[]) =>
      a.length === b.length && a.every((tag, index) => tag === b[index]);

    const attributesEqual = (a: Record<string, string>, b: Record<string, string>) => {
      const aKeys = Object.keys(a);

      return aKeys.length === Object.keys(b).length && aKeys.every((key) => a[key] === b[key]);
    };

    for (const command of commands) {
      if (command.kind === 'htmlClose') {
        continue;
      }

      const previous = previousRenderCommandMap.get(command.id);

      if (!previous || previous.kind !== command.kind) {
        continue;
      }

      // The same key must render the same component class — a changed class means a fresh instance.
      if (previous.kind === 'component' && command.kind === 'component' && previous.component !== command.component) {
        continue;
      }

      const parentId = parentIdOf(command);
      const parentPreserved = parentId === null || preserved.has(parentId);

      if (command.kind === 'component') {
        preserved.add(command.id);

        const samePlace =
          parentPreserved &&
          previous.nestingLevel === command.nestingLevel &&
          previous.domPosition === command.domPosition;

        if (!samePlace) {
          needsReattach.add(command.id);
        }

        continue;
      }

      const sameOutput =
        previous.kind === command.kind &&
        (previous.kind !== 'htmlOpen' || previous.tagName === (command as HtmlOpenRenderCommand).tagName) &&
        (previous.kind !== 'text' ||
          (previous.text === (command as TextRenderCommand).text &&
            markTagsEqual(previous.markTags, (command as TextRenderCommand).markTags)));

      if (
        parentPreserved &&
        sameOutput &&
        previous.nestingLevel === command.nestingLevel &&
        previous.domPosition === command.domPosition &&
        attributesEqual(previous.attributes, command.attributes)
      ) {
        preserved.add(command.id);
      }
    }

    // Everything that did not survive is removed first, so the ordered pass below can rebuild
    // into a clean tree. Close commands never render DOM and are skipped throughout.
    for (const [id, command] of previousRenderCommandMap) {
      if (command.kind !== 'htmlClose' && !preserved.has(id)) {
        instructions.push({ type: 'delete', command });
      }
    }

    // One pass in document order: parents are created before a child component is reattached.
    // Surviving plain elements still get an update so the cache tracks their fresh command data.
    for (const command of commands) {
      if (command.kind === 'htmlClose') {
        continue;
      }

      if (!preserved.has(command.id)) {
        instructions.push({ type: 'create', command });
      } else if (command.kind === 'component' && needsReattach.has(command.id)) {
        instructions.push({ type: 'move', command });
      } else {
        instructions.push({ type: 'update', command });
      }
    }

    return instructions;
  });

  constructor() {
    effect(() => {
      const instructions = this.renderInstructions();

      untracked(() => this.execInstructions(instructions));
    });
  }

  private createRenderCommands(richTextData: RichTextResponse) {
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

          rootCommands.push({
            kind: 'text',
            nestingLevel,
            domPosition,
            index: commandIndex++,
            attributes,
            markTags: node.marks.length ? marksToTags(node.marks) : [],
            text,
            id: 't' + textId++,
          });

          domPosition++;

          break;
        }

        case CF_BLOCKS.EMBEDDED_ASSET: {
          const assetId = node.data['target']?.sys?.id;

          if (!assetId) {
            throw richTextRendererError('asset_id_not_found', { node });
          }

          const asset = this.contentIncludesMap().getAsset(assetId);

          if (!asset) {
            throw richTextRendererError('asset_not_found', { assetId, node });
          }

          const contentType = asset.fields.file.contentType;
          const assetComponents = this.config.components;

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

          if (!component) {
            if (isDevMode()) {
              console.warn(
                'No component registered for this embedded asset! The asset will be skipped. Provide one via provideContentfulConfig({ components: … }).',
                { asset },
              );
            }

            break;
          }

          const occurrenceKey = 'asset:' + assetId;
          const occurrence = (componentIdMap.get(occurrenceKey) ?? -1) + 1;
          componentIdMap.set(occurrenceKey, occurrence);
          const id = occurrence === 0 ? occurrenceKey : `${occurrenceKey}:${occurrence}`;

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

        case CF_INLINES.HYPERLINK: {
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

          const linkComponent = this.config.components.link;

          if (!linkComponent) {
            // Without a link component the hyperlink still renders - as a plain anchor.
            rootCommands.push({
              kind: 'htmlOpen',
              nestingLevel,
              domPosition,
              index: commandIndex++,
              attributes: {
                class: 'et-contentful-rich-text-default-element et-contentful-rich-text-default-a',
                href: uri,
              },
              tagName: 'a',
              id: 'e-o' + elementOpenId++,
            });

            const anchorDomPosition = domPosition;

            nestingLevel++;
            domPosition = 0;

            rootCommands.push({
              kind: 'text',
              nestingLevel,
              domPosition,
              index: commandIndex++,
              attributes: {
                class: 'et-contentful-rich-text-default-element et-contentful-rich-text-default-span',
              },
              markTags: marksToTags(linkMarks),
              text: linkText,
              id: 't' + textId++,
            });

            nestingLevel--;
            domPosition = anchorDomPosition;

            rootCommands.push({
              kind: 'htmlClose',
              nestingLevel,
              domPosition,
              index: commandIndex++,
              tagName: 'a',
              id: 'e-c' + elementCloseId++,
            });

            domPosition++;

            break;
          }

          const textClass = linkMarks.length ? marksToClass(linkMarks) : '';

          let linkComponentId = componentIdMap.get(LINK_COMPONENT_TYPE) ?? -1;
          const linkId = LINK_COMPONENT_TYPE + ++linkComponentId;
          componentIdMap.set(LINK_COMPONENT_TYPE, linkComponentId);

          rootCommands.push({
            kind: 'component',
            nestingLevel,
            domPosition,
            index: commandIndex++,
            component: linkComponent,
            inputs: { href: uri, text: linkText, textClass },
            id: linkId,
          });

          domPosition++;

          break;
        }

        case CF_BLOCKS.EMBEDDED_ENTRY:
        case CF_INLINES.EMBEDDED_ENTRY: {
          const entryId = node.data['target']?.sys?.id;

          if (!entryId) {
            throw richTextRendererError('entry_id_not_found', { node });
          }

          const entry = this.contentIncludesMap().getEntry(entryId, ET_CONTENTFUL_ANY_ENTRY_CONTENT_TYPE_SYS_ID);

          if (!entry) {
            throw richTextRendererError('entry_not_found', { entryId, node });
          }

          const componentType = entry.sys.contentType.sys.id;

          const component = this.config.customComponents[componentType];

          if (!component) {
            throw richTextRendererError('custom_component_not_found', {
              componentType,
              customComponents: this.config.customComponents,
              entry,
            });
          }

          const occurrenceKey = 'entry:' + entryId;
          const occurrence = (componentIdMap.get(occurrenceKey) ?? -1) + 1;
          componentIdMap.set(occurrenceKey, occurrence);
          const id = occurrence === 0 ? occurrenceKey : `${occurrenceKey}:${occurrence}`;

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

  private execInstructions(instructions: RenderInstruction[]) {
    for (const instruction of instructions) {
      switch (instruction.type) {
        case 'create':
          this.runCreateInstruction(instruction.command);
          break;
        case 'update':
          this.runUpdateInstruction(instruction.command);
          break;
        case 'move':
          this.runMoveInstruction(instruction.command);
          break;
        case 'delete':
          this.runDeleteInstruction(instruction.command);
          break;
      }
    }
  }

  private runCreateInstruction(command: RenderCommand) {
    const parentElement = this.findParent(command);
    const nextElement = this.findFollowingElement(command);

    if (command.kind === 'component') {
      const inputs = signal(command.inputs);

      // Components may declare any subset of the offered inputs — only bind the declared ones.
      const declaredInputs = reflectComponentType(command.component)?.inputs ?? [];
      const bindings = declaredInputs
        .filter((declared) => declared.propName in command.inputs)
        .map((declared) => inputBinding(declared.templateName, () => inputs()[declared.propName]));

      const componentRef = this.viewContainerRef.createComponent(command.component, { bindings });

      const rootNode = this.getComponentRootNode(componentRef);

      this.renderInsertOrAppend(rootNode, parentElement, nextElement);

      this.executedCommandsCache.set(command.id, {
        command,
        componentRef,
        inputs,
        element: rootNode,
      });
    } else if (command.kind === 'text') {
      const span = this.renderer.createElement('span');
      const textSplitInLineBreaks = command.text.split('\n').filter((t) => t.trim().length > 0);

      for (const [key, value] of Object.entries(command.attributes)) {
        this.renderer.setAttribute(span, key, value);
      }

      if (command.text.startsWith('\n')) {
        const brNode = this.renderer.createElement('br');
        this.renderer.appendChild(parentElement, brNode);
      }

      // Marks are rendered as nested semantic elements inside the span, outermost mark first.
      let textContainer = span;

      for (const tag of command.markTags) {
        const markElement = this.renderer.createElement(tag);

        this.renderer.appendChild(textContainer, markElement);
        textContainer = markElement;
      }

      for (const [textPartIndex, textPart] of textSplitInLineBreaks.entries()) {
        if (textPartIndex > 0) {
          const brNode = this.renderer.createElement('br');
          this.renderer.appendChild(textContainer, brNode);
        }

        const textNode = this.renderer.createText(textPart);

        this.renderer.appendChild(textContainer, textNode);
      }

      this.renderInsertOrAppend(span, parentElement, nextElement);

      this.executedCommandsCache.set(command.id, {
        command,
        element: span,
      });
    } else if (command.kind === 'htmlOpen') {
      const element = this.renderer.createElement(command.tagName);

      for (const [key, value] of Object.entries(command.attributes)) {
        this.renderer.setAttribute(element, key, value);
      }

      this.renderInsertOrAppend(element, parentElement, nextElement);

      this.executedCommandsCache.set(command.id, {
        command,
        element,
      });
    }
  }

  private runUpdateInstruction(command: RenderCommand) {
    const cached = this.executedCommandsCache.get(command.id);

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
    this.executedCommandsCache.set(command.id, {
      ...cached,
      command,
    } as ExecutedCommandCacheItem);
  }

  private runMoveInstruction(command: RenderCommand) {
    const cached = this.executedCommandsCache.get(command.id);

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
        this.renderer.removeChild(oldParentElement, rootNode);
      }

      const newParentElement = this.findParent(command);
      const nextElement = this.findFollowingElement(command);

      this.renderInsertOrAppend(rootNode, newParentElement, nextElement);

      cached.inputs.set(command.inputs);

      this.executedCommandsCache.set(command.id, {
        ...cached,
        command,
      } as ExecutedCommandCacheItem);
    }
  }

  private runDeleteInstruction(command: RenderCommand) {
    const cached = this.executedCommandsCache.get(command.id);

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
        this.renderer.removeChild(cached.element.parentElement, cached.element);
      }
    }

    this.executedCommandsCache.delete(command.id);
  }

  private getComponentRootNode(componentRef: ComponentRef<unknown>): HTMLElement {
    return (componentRef.hostView as EmbeddedViewRef<unknown>).rootNodes[0] as HTMLElement;
  }

  private findParent(command: RenderCommand) {
    const hostElement = this.elementRef.nativeElement;
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

      parentElement = this.executedCommandsCache.get(parentCommand.id)?.element;
    }

    if (!parentElement) {
      throw new Error('Parent element not found!');
    }

    return parentElement;
  }

  private findFollowingElement(command: RenderCommand) {
    // Find the closest already rendered element at the same nesting level with a greater
    // domPosition, to insert before. Without one the element is appended to the parent.
    let nextElement: HTMLElement | undefined;
    let nextDomPosition = Infinity;

    for (const cached of this.executedCommandsCache.values()) {
      if (
        cached.command.domPosition > command.domPosition &&
        cached.command.domPosition < nextDomPosition &&
        cached.command.nestingLevel === command.nestingLevel &&
        cached.command.id !== command.id
      ) {
        nextElement = cached.element;
        nextDomPosition = cached.command.domPosition;
      }
    }

    return nextElement;
  }

  private renderInsertOrAppend(
    nodeToRender: HTMLElement,
    parentElement: HTMLElement,
    nextElement: HTMLElement | undefined,
  ) {
    if (nextElement) {
      this.renderer.insertBefore(parentElement, nodeToRender, nextElement);
    } else {
      this.renderer.appendChild(parentElement, nodeToRender);
    }
  }
}
