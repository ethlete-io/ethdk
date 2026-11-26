// Demo fixtures live here rather than in the component file. An interpolated template literal
// anywhere above an inline `template:` desynchronises the Angular VS Code extension's editor-side
// scanner, which then stops forwarding template completions to the language service - see the
// `ethlete/no-template-literal-before-inline-template` lint rule.

import { V2QueryClient, def } from '@ethlete/query';
import { CascaderDataSource, CascaderNode } from '../cascader/headless';
import { createV2DropzoneUpload } from '../dropzone/headless/dropzone-upload';

export const FRUIT_OPTIONS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
  { value: 'fig', label: 'Fig' },
] as const;

export const PLAN_OPTIONS = [
  { value: 'free', label: 'Free', description: 'One project, community support' },
  { value: 'pro', label: 'Pro', description: 'Unlimited projects, priority support' },
] as const;

export const TOPPING_OPTIONS = [
  { value: 'cheese', label: 'Cheese' },
  { value: 'ham', label: 'Ham' },
  { value: 'olives', label: 'Olives' },
] as const;

export const VIEW_MODE_OPTIONS = [
  { value: 'list', label: 'List' },
  { value: 'grid', label: 'Grid' },
  { value: 'map', label: 'Map' },
] as const;

const CASCADER_TREE: Record<string, CascaderNode<string>[]> = {
  root: [
    { value: 'euro', label: 'UEFA Euro' },
    { value: 'wc', label: 'World Cup' },
  ],
  euro: [
    { value: 'euro-group', label: 'Group stage', isLeaf: true },
    { value: 'euro-ko', label: 'Knockout stage', isLeaf: true },
  ],
  wc: [
    { value: 'wc-group', label: 'Group stage', isLeaf: true },
    { value: 'wc-ko', label: 'Knockout stage', isLeaf: true },
  ],
};

export const cascaderSource: CascaderDataSource<string> = {
  loadChildren: (parent) => CASCADER_TREE[parent ? parent.value : 'root'] ?? [],
};

type MediaLikeView = { uuid: string; name: string };

// The legacy v2 client bypasses Angular interceptors, so its built-in `mock` mechanism keeps this
// fixture self-contained - no HTTP decorator on the story.
const v2Client = new V2QueryClient({ baseRoute: 'https://control-states.demo' });

const uploadMediaV2 = v2Client.post({
  route: '/upload',
  reportProgress: true,
  types: { args: def<{ body: FormData }>(), response: def<MediaLikeView>() },
});

export const dropzoneUpload = createV2DropzoneUpload({
  queryCreator: uploadMediaV2,
  createArgs: (file) => {
    const body = new FormData();
    body.append('file', file, file.name);

    return {
      body,
      mock: {
        delay: 200,
        progress: { eventCount: 6, fileSize: Math.max(file.size, 400_000) },
        response: { uuid: file.name, name: file.name },
      },
    };
  },
  selectValue: (media: MediaLikeView) => media.uuid,
  resolveExisting: (uuid: string) => ({
    name: 'media-' + uuid + '.jpg',
    previewUrl: 'https://picsum.photos/seed/' + uuid + '/640/480',
    size: 123456,
  }),
});
