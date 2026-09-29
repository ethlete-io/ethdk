import { ContentfulFileComponent } from '../components/file';
import { ContentfulImageComponent } from '../components/image';
import { ContentfulLinkComponent } from '../components/link';
import { createContentfulConfig } from './contentful-config';

describe('createContentfulConfig', () => {
  it('keeps the default components when one is overridden', () => {
    class MyImage extends ContentfulImageComponent {}

    const { components } = createContentfulConfig({ components: { image: MyImage } });

    expect(components.image).toBe(MyImage);
    expect(components.link).toBe(ContentfulLinkComponent);
    expect(components.file).toBe(ContentfulFileComponent);
    expect(components.audio).toBeDefined();
    expect(components.video).toBeDefined();
  });

  it('keeps the default image options when one is overridden', () => {
    const { imageOptions } = createContentfulConfig({ imageOptions: { sizes: ['50vw'] } as never });

    expect(imageOptions.sizes).toEqual(['50vw']);
    expect(imageOptions.srcsetSizes).toEqual(['375w', '1280w', '1920w', '2560w']);
  });

  it('returns the defaults without a config', () => {
    expect(createContentfulConfig().components.image).toBe(ContentfulImageComponent);
    expect(createContentfulConfig(null).internalHosts).toEqual([]);
  });
});
