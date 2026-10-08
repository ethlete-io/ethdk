/* eslint-disable @typescript-eslint/naming-convention */
import { ContentfulGqlAsset } from '../../gql';
import { ContentfulEntry, ContentfulRestAsset, RichTextResponse } from '../../types';

export type ContentfulGqlRichTextEntry = {
  __typename?: string | null;
  sys: { id: string };
  [field: string]: unknown;
};

type ContentfulGqlLinkList<T> = (T | null | undefined)[] | null;

/**
 * A rich-text field as returned by the Contentful GraphQL API. Select `json` and the `links` the
 * document references, and pass the field to `[gqlRichText]` as-is.
 */
export type ContentfulGqlRichText = {
  json: RichTextResponse;
  links?: {
    assets?: {
      block?: ContentfulGqlLinkList<ContentfulGqlAsset>;
      hyperlink?: ContentfulGqlLinkList<ContentfulGqlAsset>;
    } | null;
    entries?: {
      block?: ContentfulGqlLinkList<ContentfulGqlRichTextEntry>;
      inline?: ContentfulGqlLinkList<ContentfulGqlRichTextEntry>;
      hyperlink?: ContentfulGqlLinkList<ContentfulGqlRichTextEntry>;
    } | null;
  } | null;
};

const lowerCaseFirst = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);

const toRestAsset = (asset: ContentfulGqlAsset): ContentfulRestAsset => ({
  sys: { type: 'Asset', id: asset.sys.id, createdAt: '', updatedAt: '', locale: '' },
  fields: {
    title: asset.title ?? '',
    description: asset.description ?? '',
    file: {
      url: asset.url,
      details: {
        size: asset.size,
        ...(asset.width !== null && asset.height !== null
          ? { image: { width: asset.width, height: asset.height } }
          : {}),
      },
      fileName: asset.fileName ?? null,
      contentType: asset.contentType,
    },
  },
  metadata: { tags: [] },
});

const toRestEntry = (entry: ContentfulGqlRichTextEntry): ContentfulEntry | null => {
  const { __typename, sys, ...fields } = entry;

  if (!__typename) {
    return null;
  }

  return {
    sys: {
      type: 'Entry',
      id: sys.id,
      createdAt: '',
      updatedAt: '',
      locale: '',
      contentType: { sys: { type: 'Link', linkType: 'ContentType', id: lowerCaseFirst(__typename) } },
    },
    fields,
    metadata: { tags: [] },
  };
};

const present = <T>(items: ContentfulGqlLinkList<T> | undefined) =>
  (items ?? []).filter((item): item is T => item !== null && item !== undefined);

/**
 * Maps the `links` of a GraphQL rich-text field to the entries and assets the renderer resolves
 * embeds against. An entry's content type id is its `__typename` with the first letter lower-cased,
 * which is how Contentful derives a GraphQL type name from a content type id. Entries without a
 * `__typename` are dropped.
 */
export const mapContentfulGqlLinks = (links: ContentfulGqlRichText['links']) => {
  const assets = new Map<string, ContentfulRestAsset>();
  const entries = new Map<string, ContentfulEntry>();

  for (const asset of [...present(links?.assets?.block), ...present(links?.assets?.hyperlink)]) {
    assets.set(asset.sys.id, toRestAsset(asset));
  }

  for (const gqlEntry of [
    ...present(links?.entries?.block),
    ...present(links?.entries?.inline),
    ...present(links?.entries?.hyperlink),
  ]) {
    const entry = toRestEntry(gqlEntry);

    if (entry) {
      entries.set(entry.sys.id, entry);
    }
  }

  return { assets: [...assets.values()], entries: [...entries.values()] };
};
