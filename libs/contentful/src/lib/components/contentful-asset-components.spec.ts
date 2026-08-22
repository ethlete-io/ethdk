import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContentfulGqlAsset } from '../gql';
import { provideContentfulConfig } from '../utils/contentful.util';
import { ContentfulAudioComponent } from './audio';
import { ContentfulFileComponent } from './file';
import { ContentfulImageComponent } from './image';
import { ContentfulVideoComponent } from './video';

const gqlAsset = (overrides: Partial<ContentfulGqlAsset> = {}): ContentfulGqlAsset => ({
  sys: { id: 'asset-1' },
  title: 'Asset',
  contentType: 'image/png',
  url: '//images.ctfassets.net/image.png',
  description: 'Description',
  width: 800,
  height: 600,
  size: 100,
  ...overrides,
});

const createAssetFixture = <TComponent>(component: Type<TComponent>, asset: ContentfulGqlAsset) => {
  const fixture = TestBed.createComponent(component);
  fixture.componentRef.setInput('asset', asset);
  fixture.detectChanges();

  return fixture;
};

describe('Contentful asset components', () => {
  it('renders the image component without a config provider', () => {
    TestBed.configureTestingModule({ imports: [ContentfulImageComponent] });

    const fixture = createAssetFixture(ContentfulImageComponent, gqlAsset());

    expect(fixture.nativeElement.querySelector('et-picture')).not.toBeNull();
    expect(fixture.nativeElement.classList).toContain('et-contentful-image');
  });

  it('uses the configured image background and ignores a nullable quality binding', () => {
    TestBed.configureTestingModule({
      imports: [ContentfulImageComponent],
      providers: [
        provideContentfulConfig({
          imageOptions: { backgroundColor: 'ffffff', sizes: ['100vw'], srcsetSizes: ['400w'] },
        }),
      ],
    });

    const fixture = createAssetFixture(ContentfulImageComponent, gqlAsset());
    fixture.componentRef.setInput('quality', undefined);
    fixture.detectChanges();
    const srcset = (fixture.nativeElement.querySelector('source') as HTMLSourceElement).srcset;

    expect(srcset).toContain('bg=rgb:ffffff');
    expect(srcset).not.toContain('q=NaN');
  });

  it.each([
    [ContentfulVideoComponent, 'et-contentful-video'],
    [ContentfulAudioComponent, 'et-contentful-audio'],
    [ContentfulFileComponent, 'et-contentful-file'],
  ] as const)(
    'skips a nullable gql url in %s',
    (
      component: Type<ContentfulVideoComponent | ContentfulAudioComponent | ContentfulFileComponent>,
      hostClass: string,
    ) => {
      TestBed.configureTestingModule({ imports: [component] });

      const fixture = createAssetFixture(component, gqlAsset({ url: null }));

      expect(fixture.nativeElement.classList).toContain(hostClass);
      expect(fixture.nativeElement.children).toHaveLength(0);
    },
  );

  it('protects file links opened in a new tab', () => {
    TestBed.configureTestingModule({ imports: [ContentfulFileComponent] });

    const fixture: ComponentFixture<ContentfulFileComponent> = createAssetFixture(
      ContentfulFileComponent,
      gqlAsset({ contentType: 'application/pdf' }),
    );
    const anchor = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

    expect(anchor.target).toBe('_blank');
    expect(anchor.rel).toBe('noopener noreferrer');
  });
});
