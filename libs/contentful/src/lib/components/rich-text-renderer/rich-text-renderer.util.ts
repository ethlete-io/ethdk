import { ComponentType } from '@angular/cdk/portal';
import { Block, BLOCKS, Inline, INLINES, Mark, Text } from '@contentful/rich-text-types';
import { RichTextResponse, ContentfulAsset } from '../../types';
import { ContentfulAssetComponents, ContentfulConfig } from '../../utils';
import { ContentfulAudioComponent } from '../audio';
import { ContentfulFileComponent } from '../file';
import { ContentfulImageComponent } from '../image';
import { ContentfulVideoComponent } from '../video';
import { RichTextRenderCommand } from './rich-text-renderer.types';

export const createRenderCommandsFromContentfulRichText = (options: {
  data: RichTextResponse;
  config: ContentfulConfig;
}) => {
  const { data, config } = options;

  const commands: RichTextRenderCommand[] = [];
  const assetMap = new Map<string, ContentfulAsset>();

  const assetComponents = getAssetComponentsFromConfig(config);

  for (const asset of data.links.assets.block) {
    assetMap.set(asset.sys.id, asset);
  }

  createContentfulRenderCommand(
    data.json,
    { children: commands, payload: data.json.nodeType },
    assetMap,
    config.useTailwindClasses,
    assetComponents,
    config.customComponents,
  );

  return commands;
};

export const createContentfulRenderCommand = (
  node: Block | Inline | Text,
  parent: RichTextRenderCommand,
  assetMap: Map<string, ContentfulAsset>,
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

  if (nodeType === BLOCKS.EMBEDDED_ASSET) {
    const asset = assetMap.get(nodeData['target']?.sys?.id);

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
    }
  } else if (nodeType === BLOCKS.EMBEDDED_ENTRY || nodeType === INLINES.EMBEDDED_ENTRY) {
    const componentId = nodeData['target']?.sys?.contentType?.sys?.id;
    const component = customComponents?.[componentId];

    if (component) {
      command.payload = component;
      command.data = nodeData['target']?.fields;
    } else {
      command.data = `No component found for embedded entry ${componentId} as ${nodeType}!`;
    }
  }

  if (children && (children.length !== 1 || children[0].nodeType !== 'text')) {
    children.forEach((child) => {
      createContentfulRenderCommand(child, command, assetMap, useTailwindClasses, assetComponents, customComponents);
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

export const getAssetComponentsFromConfig = (config: ContentfulConfig) => {
  return {
    file: config.components?.file ?? ContentfulFileComponent,
    image: config.components?.image ?? ContentfulImageComponent,
    video: config.components?.video ?? ContentfulVideoComponent,
    audio: config.components?.audio ?? ContentfulAudioComponent,
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

    // TODO(TRB): These should render components
    case BLOCKS.EMBEDDED_ENTRY:
      return 'div';
    case INLINES.EMBEDDED_ENTRY:
      return 'div';

    default:
      return 'div';
  }
};
