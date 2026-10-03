import { TestBed } from '@angular/core/testing';
import { provideImageConfig } from '../../utils/picture.utils';
import { PictureComponent } from './picture.component';

const combine = (srcset: string, baseUrl?: string) => {
  TestBed.configureTestingModule({ providers: [provideImageConfig({ baseUrl })] });

  const picture = TestBed.createComponent(PictureComponent).componentInstance;

  return picture._combineWithConfig({ srcset, type: null, media: null, sizes: null }).srcset;
};

describe('PictureComponent base url', () => {
  it('prefixes every candidate of a srcset', () => {
    expect(combine('a.jpg 400w, b.jpg 800w', 'https://cdn.example.com')).toBe(
      'https://cdn.example.com/a.jpg 400w, https://cdn.example.com/b.jpg 800w',
    );
  });

  it('prefixes only the relative candidates', () => {
    expect(combine('https://other.example.com/a.jpg 1x, /b.jpg 2x', 'https://cdn.example.com')).toBe(
      'https://other.example.com/a.jpg 1x, https://cdn.example.com/b.jpg 2x',
    );
  });

  it('leaves a data URI with commas alone', () => {
    expect(combine('data:image/png;base64,abc,def', 'https://cdn.example.com')).toBe('data:image/png;base64,abc,def');
  });

  it('leaves the srcset alone without a base url', () => {
    expect(combine('a.jpg 400w, b.jpg 800w')).toBe('a.jpg 400w, b.jpg 800w');
  });
});
