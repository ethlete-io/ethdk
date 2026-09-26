import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ContentfulRestAsset } from '../../types';
import { provideContentfulFileLabels } from './contentful-file-labels';
import { ContentfulFileComponent } from './contentful-file.component';

const createAsset = (size: number | null): ContentfulRestAsset =>
  ({
    sys: { type: 'Asset', id: 'f1', createdAt: '', updatedAt: '', locale: 'en-US' },
    fields: {
      title: 'Report',
      description: '',
      file: { url: '//cdn/report.pdf', details: { size }, fileName: 'report.pdf', contentType: 'application/pdf' },
    },
    metadata: { tags: [] },
  }) as ContentfulRestAsset;

const render = (size: number | null, providers: Provider[] = []) => {
  TestBed.configureTestingModule({ imports: [ContentfulFileComponent], providers });

  const fixture = TestBed.createComponent(ContentfulFileComponent);
  fixture.componentRef.setInput('asset', createAsset(size));
  fixture.detectChanges();

  return (fixture.nativeElement as HTMLElement).querySelector('a')?.textContent?.replace(/\s+/g, ' ').trim();
};

describe('ContentfulFileComponent', () => {
  it('shows the size scaled to a readable unit', () => {
    expect(render(1536)).toBe('Report (1.5 KB)');
  });

  it('omits the size when the asset has none', () => {
    expect(render(null)).toBe('Report');
  });

  it('words the size through provideContentfulFileLabels', () => {
    expect(render(2048, [provideContentfulFileLabels({ fileSize: (bytes) => `[${bytes} Byte]` })])).toBe(
      'Report [2048 Byte]',
    );
  });
});
