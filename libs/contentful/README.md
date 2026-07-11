# @ethlete/contentful

Angular components for rendering Contentful content — a diffing rich-text renderer with custom-component support for embedded entries, asset components (image, video, audio, file, link), and typed helpers for the REST and GraphQL APIs.

## Installation

```bash
yarn add @ethlete/contentful
```

## Usage

```ts
@Component({
  imports: [ContentfulRichTextRendererComponent],
  providers: [provideContentfulConfig({ customComponents: { newsElement: NewsElementComponent } })],
  template: `<et-contentful-rich-text-renderer [content]="data()" richTextPath="items[0].fields.html" />`,
})
export class NewsArticleComponent {}
```

## Documentation

Full guide (rich-text rendering, custom components, asset components, config, GQL helpers) on the docs site:

- [Overview & usage](https://ethlete-sdk-docs.web.app/contentful/)
