---
"@ethlete/contentful": minor
---

Change the type of `ContentfulIncludeMap` to be more ergonomic. Instead of returning raw maps for assets and entries, it now returns a generic `getEntry` function as well as a `getAsset` function. This makes it easier to work with the included assets and entries.


```ts
  // The type of the fields property inside a contentful entry. Could be just about anything.
  interface MyImageCollectionFields {
    title: string;
    images: ContentfulAsset[];
  }

  // Inside a component class that gets rendered by the rich-text renderer
  includes = input.required<ContentfulIncludeMap>();

  // "my-content-type" is the type defined by contentful inside entry.sys.id
  // This is needed to make sure the entry is of the correct type since the user could put any entry here.
  myImageCollection = computed(() => this.includes().getEntry<MyImageCollectionFields>('someId', 'my-image-collection'));
```