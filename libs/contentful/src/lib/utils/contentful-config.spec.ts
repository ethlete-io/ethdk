import { ContentfulFileComponent } from '../components/file';
import { ContentfulImageComponent } from '../components/image';
import { ContentfulLinkComponent } from '../components/link';
import { createContentfulConfig } from './contentful-config';
import { CONTENTFUL_DEFAULT_COMPONENTS } from './contentful-default-components';

describe('createContentfulConfig', () => {
  it('registers no components without the default components', () => {
    expect(createContentfulConfig().components).toEqual({});
    expect(createContentfulConfig(null).internalHosts).toEqual([]);
  });

  it('registers the shipped components when the default components are spread', () => {
    const { components } = createContentfulConfig({ ...CONTENTFUL_DEFAULT_COMPONENTS });

    expect(components.image).toBe(ContentfulImageComponent);
    expect(components.link).toBe(ContentfulLinkComponent);
    expect(components.file).toBe(ContentfulFileComponent);
    expect(components.audio).toBeDefined();
    expect(components.video).toBeDefined();
  });

  it('keeps the default components when one is overridden', () => {
    class MyImage extends ContentfulImageComponent {}

    const config = createContentfulConfig({
      components: { ...CONTENTFUL_DEFAULT_COMPONENTS.components, image: MyImage },
    });

    expect(config.components.image).toBe(MyImage);
    expect(config.components.link).toBe(ContentfulLinkComponent);
  });

  it('keeps the default image options when one is overridden', () => {
    const { imageOptions } = createContentfulConfig({ imageOptions: { sizes: ['50vw'] } });

    expect(imageOptions.sizes).toEqual(['50vw']);
    expect(imageOptions.srcsetSizes).toEqual(['375w', '1280w', '1920w', '2560w']);
  });

  it('falls back to the defaults for options passed as undefined', () => {
    const config = createContentfulConfig({
      internalHosts: undefined,
      customComponents: undefined,
      components: undefined,
      imageOptions: { srcsetSizes: undefined, sizes: undefined, backgroundColor: undefined },
    });

    expect(config.internalHosts).toEqual([]);
    expect(config.customComponents).toEqual({});
    expect(config.components).toEqual({});
    expect(config.imageOptions).toEqual({
      srcsetSizes: ['375w', '1280w', '1920w', '2560w'],
      sizes: ['100vw'],
      backgroundColor: null,
    });
  });

  it('keeps an explicitly empty srcsetSizes and a null background color', () => {
    const { imageOptions } = createContentfulConfig({ imageOptions: { srcsetSizes: [], backgroundColor: null } });

    expect(imageOptions.srcsetSizes).toEqual([]);
    expect(imageOptions.backgroundColor).toBeNull();
  });

  it('does not share the fallback arrays between configs', () => {
    expect(createContentfulConfig({ internalHosts: ['example.com'] }).internalHosts).toEqual(['example.com']);
    expect(createContentfulConfig().internalHosts).toEqual([]);
  });
});
