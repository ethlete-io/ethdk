import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PaginationHeadService } from './pagination-head.service';

const documentAt = (origin: string) =>
  new Proxy(document, {
    get: (target, property) => {
      if (property === 'location') return { ...target.location, origin };

      const value = Reflect.get(target, property);

      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

describe('PaginationHeadService', () => {
  afterEach(() => document.querySelector(`link[rel='canonical']`)?.remove());

  it('builds the canonical url from the document origin', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        PaginationHeadService,
        { provide: DOCUMENT, useValue: documentAt('https://example.com') },
      ],
    });

    const service = TestBed.inject(PaginationHeadService);
    service.addCanonicalTag = true;
    service._updateHead(2);

    expect(document.querySelector(`link[rel='canonical']`)?.getAttribute('href')).toBe('https://example.com/');
  });
});
