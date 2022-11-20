import { ComponentType } from '@angular/cdk/portal';
import { Block, BLOCKS, Inline, INLINES, Mark, Text } from '@contentful/rich-text-types';
import {
  ContentfulAsset,
  ContentfulAssetComponents,
  ContentfulConfig,
  ContentfulEntryBase,
  RichTextResponse,
} from '../../types';
import { ContentfulResourceMap, RichTextRenderCommand } from './rich-text-renderer.types';

export const createRenderCommandsFromContentfulRichText = (options: {
  data: RichTextResponse;
  config: ContentfulConfig;
}) => {
  const { data, config } = options;

  const commands: RichTextRenderCommand[] = [];
  const resourceMap = createContentfulResourceMap(data.links);

  createContentfulRenderCommand(
    data.json,
    { children: commands, payload: data.json.nodeType },
    resourceMap,
    config.useTailwindClasses,
    config.components,
    config.customComponents,
  );

  return commands;
};

export const createContentfulRenderCommand = (
  node: Block | Inline | Text,
  parent: RichTextRenderCommand,
  resourceMap: ContentfulResourceMap,
  useTailwindClasses: boolean,
  assetComponents: ContentfulAssetComponents,
  customComponents: Record<string, ComponentType<unknown>> | undefined,
) => {
  const { nodeType, data: nodeData } = node;

  const { children, marks, value } = getContentfulNodeProps(node);

  const command: RichTextRenderCommand = {
    payload: translateContentfulNodeTypeToHtmlTag(nodeType),
    data: value,
    attributes: {
      ...(marks
        ? {
            class: transformContentfulMarks(marks, useTailwindClasses),
          }
        : {}),
      ...(nodeData['uri'] ? { href: nodeData['uri'], target: '_blank' } : {}),
    },
    children: [],
  };

  const entryId = nodeData['target']?.sys?.id;

  if (nodeType === BLOCKS.EMBEDDED_ASSET) {
    const asset = resourceMap.assetsBlock.get(entryId);

    if (asset) {
      const isImage = asset.contentType.startsWith('image/');
      const isVideo = asset.contentType.startsWith('video/');
      const isAudio = asset.contentType.startsWith('audio/');

      command.data = asset;

      if (isImage) {
        command.payload = assetComponents.image;
      } else if (isVideo) {
        command.payload = assetComponents.video;
      } else if (isAudio) {
        command.payload = assetComponents.audio;
      } else {
        command.payload = assetComponents.file;
      }
    } else {
      console.warn(`No asset found for entry id "${entryId}"!`, nodeData);
    }
  } else if (nodeType === BLOCKS.EMBEDDED_ENTRY || nodeType === INLINES.EMBEDDED_ENTRY) {
    const entry = resourceMap.entriesBlock.get(entryId) ?? resourceMap.entriesInline.get(entryId);

    if (entry) {
      const type = entry?.__typename ?? 'ET_UNKNOWN';
      const component = customComponents?.[type];

      if (component) {
        command.payload = component;
        command.data = entry;
      } else {
        command.data = `ERROR: No component found for embedded entry "${type}" as "${nodeType}"!`;
      }
    } else {
      console.warn(`No entry found for entry id "${entryId}"!`, nodeData);
    }
  }

  if (children && (children.length !== 1 || children[0].nodeType !== 'text')) {
    children.forEach((child) => {
      createContentfulRenderCommand(child, command, resourceMap, useTailwindClasses, assetComponents, customComponents);
    });
  }

  parent.children.push(command);

  return command;
};

export const getContentfulNodeProps = (node: Block | Inline | Text) => {
  const children = 'content' in node ? node.content : null;
  let marks: Mark[] | null = null;
  let value: string | null = null;

  if (children && children.length === 1 && children[0].nodeType === 'text') {
    marks = children[0].marks?.length ? children[0].marks : null;
    value = children[0].value;
  } else {
    marks = 'marks' in node ? (node.marks?.length ? node.marks : null) : null;
    value = 'value' in node ? node.value : null;
  }

  return {
    children,
    marks,
    value,
  };
};

export const transformContentfulMarks = (marks: Mark[], useTailwindClasses: boolean) => {
  return marks
    .map((mark) => {
      switch (mark.type) {
        case 'bold':
          return useTailwindClasses ? 'font-bold' : mark.type;
        case 'italic':
          return useTailwindClasses ? 'italic' : mark.type;
        case 'underline':
          return useTailwindClasses ? 'underline' : mark.type;
        case 'code':
          return useTailwindClasses ? 'font-mono' : mark.type;
        default:
          return mark.type;
      }
    })
    .join(' ');
};

export const translateContentfulNodeTypeToHtmlTag = (nodeType: 'text' | BLOCKS | INLINES) => {
  switch (nodeType) {
    case BLOCKS.HEADING_1:
      return 'h1';
    case BLOCKS.HEADING_2:
      return 'h2';
    case BLOCKS.HEADING_3:
      return 'h3';
    case BLOCKS.HEADING_4:
      return 'h4';
    case BLOCKS.HEADING_5:
      return 'h5';
    case BLOCKS.HEADING_6:
      return 'h6';
    case BLOCKS.PARAGRAPH:
      return 'p';
    case BLOCKS.UL_LIST:
      return 'ul';
    case BLOCKS.OL_LIST:
      return 'ol';
    case BLOCKS.LIST_ITEM:
      return 'li';
    case BLOCKS.HR:
      return 'hr';
    case BLOCKS.QUOTE:
      return 'blockquote';
    case BLOCKS.TABLE:
      return 'table';
    case BLOCKS.TABLE_ROW:
      return 'tr';
    case BLOCKS.TABLE_CELL:
      return 'td';
    case BLOCKS.TABLE_HEADER_CELL:
      return 'th';
    case BLOCKS.EMBEDDED_ASSET:
      return 'div';

    case INLINES.HYPERLINK:
      return 'a';
    case INLINES.ENTRY_HYPERLINK:
      return 'a';
    case INLINES.ASSET_HYPERLINK:
      return 'a';

    case 'text':
      return 'span';

    // Will be ignored by the renderer
    case 'document':
      return 'document';

    case BLOCKS.EMBEDDED_ENTRY:
      return 'div';
    case INLINES.EMBEDDED_ENTRY:
      return 'div';

    default:
      return 'div';
  }
};

export const createContentfulResourceMap = (links: RichTextResponse['links']): ContentfulResourceMap => {
  const resourceMap = {
    assetsBlock: createContentfulMap<ContentfulAsset>(links?.assets?.block),
    entriesInline: createContentfulMap(links?.entries?.inline),
    entriesBlock: createContentfulMap(links?.entries?.block),
  } as const;

  return resourceMap;
};

export const createContentfulMap = <T extends ContentfulEntryBase>(links: Array<T> | null | undefined) => {
  const assetMap = new Map<string, T>();

  if (links) {
    for (const link of links) {
      if (!link?.sys?.id) {
        console.warn('Link has no sys.id property. Please include it inside your query.', link);
        continue;
      }

      assetMap.set(link.sys.id, link);
    }
  }

  return assetMap;
};
