import { ContentfulFileComponent } from '../components/file';
import { ContentfulImageComponent } from '../components/image';
import { ContentfulLinkComponent } from '../components/link';
import { createContentfulConfig } from './contentful-config';
import { withContentfulDefaultComponents } from './contentful-default-components';

describe('createContentfulConfig', () => {
  it('registers no components without the default components feature', () => {
    expect(createContentfulConfig().components).toEqual({});
    expect(createContentfulConfig(null).internalHosts).toEqual([]);
  });

  it('registers the shipped components with the default components feature', () => {
    const { components } = createContentfulConfig({ features: [withContentfulDefaultComponents()] });

    expect(components.image).toBe(ContentfulImageComponent);
    expect(components.link).toBe(ContentfulLinkComponent);
    expect(components.file).toBe(ContentfulFileComponent);
    expect(components.audio).toBeDefined();
    expect(components.video).toBeDefined();
  });

  it('keeps the default components when one is overridden', () => {
    class MyImage extends ContentfulImageComponent {}

    const config = createContentfulConfig({
      components: { image: MyImage },
      features: [withContentfulDefaultComponents()],
    });

    expect(config.components.image).toBe(MyImage);
    expect(config.components.link).toBe(ContentfulLinkComponent);
    expect('features' in config).toBe(false);
  });

  it('keeps the default image options when one is overridden', () => {
    const { imageOptions } = createContentfulConfig({ imageOptions: { sizes: ['50vw'] } as never });

    expect(imageOptions.sizes).toEqual(['50vw']);
    expect(imageOptions.srcsetSizes).toEqual(['375w', '1280w', '1920w', '2560w']);
  });
});
