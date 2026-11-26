import { DOCUMENT, inject } from '@angular/core';
import { injectRenderer } from './renderer';

export type FileDownloadOptions = {
  /**
   * The file's body - a string, a `Blob`, or the parts to build one from. A `Blob` is re-wrapped, so
   * {@link FileDownloadOptions.type} still decides the MIME type.
   */
  content: BlobPart | BlobPart[];

  /** The name the browser saves the file under, extension included. */
  filename: string;

  /** MIME type of the generated blob, e.g. `application/json`. */
  type?: string;
};

/**
 * Hands the user a file the browser downloads. Call it once from an injection context - a field
 * initializer - and the function it hands back can then be called from anywhere, including a click
 * handler.
 *
 * A no-op where there is no browser (server-side rendering), so a toolbar button needs no platform
 * check of its own. Use {@link createObjectUrlHandle} instead when the URL has to outlive the call.
 *
 * @example
 * private download = injectFileDownload();
 *
 * protected save() {
 *   this.download({ content: json, filename: 'session.json', type: 'application/json' });
 * }
 */
export const injectFileDownload = () => {
  const document = inject(DOCUMENT);
  const renderer = injectRenderer();

  return (options: FileDownloadOptions) => {
    // No window means no browser: server-side there is nothing to hand a file to.
    const view = document.defaultView;

    if (!view) return;

    const { content, filename, type } = options;
    const parts = Array.isArray(content) ? content : [content];
    const url = view.URL.createObjectURL(new view.Blob(parts, type ? { type } : undefined));
    const link = renderer.createElement('a');

    renderer.setProperties(link, { href: url, download: filename, rel: 'noopener' });
    renderer.setStyle(link, { display: 'none' });

    // Firefox only follows the click of an anchor that is in the document.
    renderer.appendChild(document.body, link);
    link.click();
    renderer.removeChild(document.body, link);

    // The blob would otherwise be held until the tab closes; the click has already read it.
    view.URL.revokeObjectURL(url);
  };
};
