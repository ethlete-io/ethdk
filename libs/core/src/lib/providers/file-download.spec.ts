import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectFileDownload } from './file-download';

describe('injectFileDownload', () => {
  let injector: Injector;
  let anchors: HTMLAnchorElement[];
  let written: Blob[];
  /** Whether the anchor was in the document at the moment it was clicked - the Firefox requirement. */
  let connectedOnClick: boolean[];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    injector = TestBed.inject(Injector);

    anchors = [];
    written = [];
    connectedOnClick = [];

    const create = document.createElement.bind(document);

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = create(tag);

      if (tag === 'a') {
        const anchor = element as HTMLAnchorElement;

        vi.spyOn(anchor, 'click').mockImplementation(() => connectedOnClick.push(anchor.isConnected));
        anchors.push(anchor);
      }

      return element;
    });

    // jsdom has no object URLs, and this is also how the file's content is read back.
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      written.push(blob as Blob);

      return 'blob:test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  const download = () => runInInjectionContext(injector, () => injectFileDownload());

  it('writes the content under the given name and type', async () => {
    download()({ content: '{"a":1}', filename: 'session.json', type: 'application/json' });

    expect(anchors[0]?.getAttribute('download')).toBe('session.json');
    expect(written[0]?.type).toBe('application/json');
    await expect(written[0]?.text()).resolves.toBe('{"a":1}');
  });

  it('joins a list of parts into one file', async () => {
    download()({ content: ['a;b\r\n', '1;2'], filename: 'table.csv' });

    await expect(written[0]?.text()).resolves.toBe('a;b\r\n1;2');
  });

  it('clicks the anchor while it is in the document, which is what Firefox follows', () => {
    download()({ content: 'a', filename: 'a.txt' });

    expect(connectedOnClick).toEqual([true]);
  });

  it('leaves no anchor behind, and holds on to no blob', () => {
    download()({ content: 'a', filename: 'a.txt' });

    expect(anchors[0]?.isConnected).toBe(false);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
});
