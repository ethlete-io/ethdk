import { Component, DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectFileDownload } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-export-toolbar',
  template: '<button (click)="exportSession()" class="export" type="button">Export</button>',
})
class ExportToolbarComponent {
  private download = injectFileDownload();

  exportSession() {
    this.download({ content: JSON.stringify({ id: 1 }), filename: 'session.json', type: 'application/json' });
  }

  exportCsv() {
    this.download({ content: ['a,b\n', new Blob(['1,2\n'])], filename: 'rows.csv' });
  }
}

type Download = { href: string; download: string; rel: string; connected: boolean; hidden: boolean };

const trackDownloads = () => {
  const blobs = new Map<string, Blob>();
  const downloads: Download[] = [];
  const revoked: string[] = [];
  let next = 0;

  vi.spyOn(URL, 'createObjectURL').mockImplementation((object) => {
    const url = `blob:scenario/${++next}`;

    blobs.set(url, object as Blob);

    return url;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => void revoked.push(url));

  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof HTMLAnchorElement)) return;

    event.preventDefault();
    downloads.push({
      href: event.target.href,
      download: event.target.download,
      rel: event.target.rel,
      connected: event.target.isConnected,
      hidden: event.target.style.display === 'none',
    });
  };

  document.addEventListener('click', onClick);

  return { blobs, downloads, revoked, stop: () => document.removeEventListener('click', onClick) };
};

describe('file download scenarios', () => {
  const scenario = useScenario();

  afterEach(() => vi.restoreAllMocks());

  it('downloads a generated file from a click handler and cleans up the link and the object URL', async () => {
    const s = scenario();
    const tracker = trackDownloads();
    const fixture = TestBed.createComponent(ExportToolbarComponent);
    const host = fixture.nativeElement as HTMLElement;
    const bodyChildren = document.body.childElementCount;

    s.tick();
    host.querySelector<HTMLButtonElement>('.export')?.click();

    expect(tracker.downloads).toEqual([
      { href: 'blob:scenario/1', download: 'session.json', rel: 'noopener', connected: true, hidden: true },
    ]);
    expect(tracker.revoked).toEqual(['blob:scenario/1']);
    expect(document.body.childElementCount).toBe(bodyChildren);

    const blob = tracker.blobs.get('blob:scenario/1');

    expect(blob?.type).toBe('application/json');
    expect(await blob?.text()).toBe('{"id":1}');

    fixture.componentInstance.exportCsv();

    const csv = tracker.blobs.get('blob:scenario/2');

    expect(tracker.downloads[1]?.download).toBe('rows.csv');
    expect(csv?.type).toBe('');
    expect(await csv?.text()).toBe('a,b\n1,2\n');

    tracker.stop();
    fixture.destroy();
  });

  it('does nothing where there is no window, as during server rendering', () => {
    const s = scenario();
    const tracker = trackDownloads();
    const serverDocument = document.implementation.createHTMLDocument('server');
    const download = s.consumer([{ provide: DOCUMENT, useValue: serverDocument }]).run(() => injectFileDownload());

    download({ content: 'x', filename: 'x.txt' });

    expect(tracker.blobs.size).toBe(0);
    expect(tracker.downloads).toEqual([]);

    tracker.stop();
  });
});
