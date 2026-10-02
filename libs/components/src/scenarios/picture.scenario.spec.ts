import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  extractFirstImageUrl,
  injectPictureConfig,
  normalizePictureSizes,
  normalizePictureSource,
  PICTURE_IMPORTS,
  PICTURE_STATES,
  PictureComponent,
  PictureErrorDirective,
  PicturePlaceholderDirective,
  PictureSource,
  providePictureConfig,
  withPictureBaseUrl,
} from '../index';
import '../test-helpers';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-team-photo',
  imports: [PICTURE_IMPORTS],
  template: `
    <et-picture
      [sources]="sources()"
      [defaultSrc]="defaultSrc()"
      [sizes]="['(min-width: 800px) 50vw', '100vw']"
      [aspectRatio]="16 / 9"
      (imageLoad)="loads.push($event)"
      (imageError)="errorCount = errorCount + 1"
      alt="Team A lining up"
      figcaption="Team A before kickoff"
      fit="cover"
    >
      <ng-template etPicturePlaceholder><span class="photo-placeholder">Loading photo</span></ng-template>
      <ng-template etPictureError><p class="photo-error">Photo unavailable</p></ng-template>
    </et-picture>
  `,
})
class TeamPhotoComponent {
  sources = signal<(PictureSource | string)[]>([
    { srcset: 'media/team-a-wide.avif', media: '(min-width: 800px)' },
    'media/team-a-400.webp 400w, media/team-a-800.webp 800w',
  ]);
  defaultSrc = signal<PictureSource | string | null>('media/team-a.jpg');
  loads: { naturalWidth: number; naturalHeight: number }[] = [];
  errorCount = 0;
  picture = viewChild.required(PictureComponent);
  config = injectPictureConfig();
}

@Component({
  selector: 'et-scenario-hero',
  imports: [PictureComponent, PicturePlaceholderDirective, PictureErrorDirective],
  template: `
    <et-picture
      [sources]="['https://images.example.com/hero.png']"
      alt=""
      defaultSrc="data:image/png;base64,iVBORw0KGgo,AAAA"
      width="1200"
      height="600"
      aspectRatio="2"
      priority
    />
    <et-picture [sources]="orphanSources()" alt="No fallback">
      <ng-template etPictureError><p class="orphan-error">Nothing to show</p></ng-template>
    </et-picture>
  `,
})
class HeroComponent {
  orphanSources = signal(['media/orphan.webp']);
}

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const loadImage = (img: HTMLImageElement, naturalWidth: number, naturalHeight: number) => {
  Object.defineProperty(img, 'naturalWidth', { configurable: true, value: naturalWidth });
  Object.defineProperty(img, 'naturalHeight', { configurable: true, value: naturalHeight });
  img.dispatchEvent(new Event('load'));
};

describe('picture scenarios', () => {
  const scenario = useScenario({ providers: [providePictureConfig({ baseUrl: 'https://cdn.example.com/' })] });

  it('renders art-directed sources from the configured CDN and tracks loading, load and error', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(TeamPhotoComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();

    const picture = query('et-picture', host);
    const img = query<HTMLImageElement>('img', host);
    const sources = queryAll('source', host);

    expect(app.config.baseUrl).toBe('https://cdn.example.com/');
    expect(
      sources.map((source) => [
        source.getAttribute('type'),
        source.getAttribute('srcset'),
        source.getAttribute('media'),
        source.getAttribute('sizes'),
      ]),
    ).toEqual([
      [
        'image/avif',
        'https://cdn.example.com/media/team-a-wide.avif',
        '(min-width: 800px)',
        '(min-width: 800px) 50vw, 100vw',
      ],
      [
        'image/webp',
        'https://cdn.example.com/media/team-a-400.webp 400w, https://cdn.example.com/media/team-a-800.webp 800w',
        null,
        '(min-width: 800px) 50vw, 100vw',
      ],
    ]);
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/media/team-a.jpg');
    expect(img.alt).toBe('Team A lining up');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('fetchpriority')).toBe('auto');
    expect(query('figcaption', host).textContent?.trim()).toBe('Team A before kickoff');
    expect(picture.getAttribute('data-fit')).toBe('cover');
    expect(picture.getAttribute('data-aspect-ratio')).toBe(String(16 / 9));
    expect(picture.getAttribute('data-state')).toBe(PICTURE_STATES.LOADING);
    expect(query('.et-picture-slot', host).getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('.photo-placeholder')).not.toBeNull();
    expect(app.picture().naturalSize()).toBeNull();

    loadImage(img, 1600, 900);
    s.tick();
    expect(picture.getAttribute('data-state')).toBe(PICTURE_STATES.LOADED);
    expect(host.querySelector('.photo-placeholder')).toBeNull();
    expect(app.loads).toEqual([{ naturalWidth: 1600, naturalHeight: 900 }]);
    expect(app.picture().naturalSize()).toEqual({ width: 1600, height: 900 });
    expect(app.picture().naturalAspectRatio()).toBeCloseTo(16 / 9);

    app.defaultSrc.set({ srcset: 'media/team-b.jpg 1x, media/team-b@2x.jpg 2x' });
    s.tick();
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/media/team-b.jpg');
    expect(img.getAttribute('srcset')).toBe(
      'https://cdn.example.com/media/team-b.jpg 1x, https://cdn.example.com/media/team-b@2x.jpg 2x',
    );
    expect(app.picture().state()).toBe(PICTURE_STATES.LOADING);
    expect(host.querySelector('.photo-placeholder')).not.toBeNull();

    img.dispatchEvent(new Event('error'));
    s.tick();
    expect(app.picture().state()).toBe(PICTURE_STATES.ERROR);
    expect(app.errorCount).toBe(1);
    expect(app.picture().naturalAspectRatio()).toBeNull();
    expect(host.querySelector('.photo-error')?.textContent).toBe('Photo unavailable');
    expect(host.querySelector('.et-picture-slot')?.hasAttribute('aria-hidden')).toBe(false);
  });

  it('loads a hero eagerly, keeps data URIs whole and reports sources without a fallback as an error', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HeroComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();

    const [hero, orphan] = queryAll('et-picture', host);
    const img = query<HTMLImageElement>('img', hero);

    expect(query('source', hero).getAttribute('srcset')).toBe('https://images.example.com/hero.png');
    expect(query('source', hero).getAttribute('type')).toBe('image/png');
    expect(img.getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo,AAAA');
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
    expect([img.getAttribute('width'), img.getAttribute('height')]).toEqual(['1200', '600']);
    expect(hero?.hasAttribute('data-aspect-ratio')).toBe(false);
    expect(hero?.querySelector('figcaption')).toBeNull();

    expect(orphan?.querySelector('img')).toBeNull();
    expect(orphan?.getAttribute('data-state')).toBe(PICTURE_STATES.ERROR);
    expect(orphan?.querySelector('.orphan-error')?.textContent).toBe('Nothing to show');
    fixture.componentInstance.orphanSources.set(['media/orphan.avif', 'media/orphan.webp']);
    s.tick();

    expect(orphan?.getAttribute('data-state')).toBe(PICTURE_STATES.ERROR);
    s.expectWarning('`sources` is set but `defaultSrc` is not');
    expect(s.warnings).toHaveLength(0);
  });

  it('resolves sources with the exported helpers the way the component does', () => {
    const s = scenario();

    expect(extractFirstImageUrl('a.jpg 1x, b.jpg 2x')).toBe('a.jpg');
    expect(extractFirstImageUrl({ srcset: '  hero-400.webp 400w' })).toBe('hero-400.webp');
    expect(extractFirstImageUrl('data:image/gif;base64,R0lG,ODlh')).toBe('data:image/gif;base64,R0lG,ODlh');
    expect(extractFirstImageUrl(null)).toBeNull();

    expect(normalizePictureSource('crest.svg')).toEqual({
      type: 'image/svg+xml',
      srcset: 'crest.svg',
      media: null,
      sizes: null,
    });
    expect(normalizePictureSource({ srcset: 'https://api.example.com/media/42', type: 'image/jpeg' }).type).toBe(
      'image/jpeg',
    );
    expect(normalizePictureSource({ srcset: 'https://api.example.com/media/42' }).type).toBeFalsy();
    s.expectWarning('Could not infer a mime type');

    expect(normalizePictureSizes(['(min-width: 600px) 33vw', '100vw'])).toBe('(min-width: 600px) 33vw, 100vw');
    expect(normalizePictureSizes('100vw')).toBe('100vw');
    expect(normalizePictureSizes([])).toBeNull();

    expect(withPictureBaseUrl({ srcset: '/a.jpg 1x, b.jpg 2x' }, { baseUrl: 'https://cdn.example.com//' }).srcset).toBe(
      'https://cdn.example.com/a.jpg 1x, https://cdn.example.com/b.jpg 2x',
    );
    expect(withPictureBaseUrl({ srcset: 'a.jpg' }, null).srcset).toBe('a.jpg');
    expect(
      withPictureBaseUrl({ srcset: 'data:image/png;base64,x,y' }, { baseUrl: 'https://cdn.example.com' }).srcset,
    ).toBe('data:image/png;base64,x,y');
  });
});
