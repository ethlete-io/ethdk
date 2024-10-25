/**
 * Infers the mime type of a given url or srcset.
 * If a srcset is provided, it will infer the mime type of the first url in the srcset.
 * If the srcset contains a query parameter `?fm=`, it will use the value of that parameter, since it is often used to specify the file format in image api's like contentful.
 */
export const inferMimeType = (srcset: string) => {
  if (!srcset) return null;

  const urls = srcset.split(',');
  const firstUrl = urls[0];

  if (!firstUrl) return null;

  const containsFm = firstUrl.includes('?fm=');
  let fileExtension: string | null = null;

  if (containsFm) {
    const fmMatch = firstUrl.match(/\?fm=(\w+)/);

    if (fmMatch && fmMatch[1]) {
      fileExtension = fmMatch[1].toLowerCase();
    }
  }

  if (!fileExtension) {
    const noQueryUrl = firstUrl.split('?')[0] || firstUrl;

    const lastDotIndex = noQueryUrl.lastIndexOf('.');

    if (lastDotIndex === -1) return null;

    fileExtension = noQueryUrl.substring(lastDotIndex + 1).toLowerCase();
  }

  if (fileExtension) {
    switch (fileExtension) {
      case 'avif':
        return 'image/avif';
      case 'bmp':
        return 'image/bmp';
      case 'gif':
        return 'image/gif';
      case 'ico':
        return 'image/vdn.microsoft.icon';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'svg':
        return 'image/svg+xml';
      case 'tif':
      case 'tiff':
        return 'image/tiff';
      case 'webp':
        return 'image/webp';
      case 'aac':
        return 'audio/aac';
      case 'abw':
        return 'application/x-abiword';
      case 'arc':
        return 'application/x-freearc';
      case 'avi':
        return 'video/x-msvideo';
      case 'azw':
        return 'application/vnd.amazon.ebook';
      case 'bin':
        return 'application/octet-stream';
      case 'bz':
        return 'application/x-bzip';
      case 'bz2':
        return 'application/x-bzip2';
      case 'cda':
        return 'application/x-cdf';
      case 'csh':
        return 'application/x-csh';
      case 'css':
        return 'text/css';
      case 'csv':
        return 'text/csv';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'eot':
        return 'application/vnd.ms-fontobject';
      case 'epub':
        return 'application/epub+zip';
      case 'gz':
        return 'application/gzip';
      case 'htm':
      case 'html':
        return 'text/html';
      case 'ics':
        return 'text/calendar';
      case 'jar':
        return 'application/java-archive';
      case 'js':
        return 'text/javascript';
      case 'json':
        return 'application/json';
      case 'jsonld':
        return 'application/ld+json';
      case 'mid':
      case 'midi':
        return 'audio/midi';
      case 'mjs':
        return 'text/javascript';
      case 'mp3':
        return 'audio/mpeg';
      case 'mp4':
        return 'video/mp4';
      case 'mpeg':
        return 'video/mpeg';
      case 'mpkg':
        return 'tapplication/vnd.apple.installer+xml';
      case 'odp':
        return 'application/vnd.oasis.opendocument.presentation';
      case 'ods':
        return 'application/vnd.oasis.opendocument.spreadsheet';
      case 'odt':
        return 'application/vnd.oasis.opendocument.text';
      case 'oga':
        return 'audio/ogg';
      case 'ogv':
        return 'video/ogg';
      case 'ogx':
        return 'application/ogg';
      case 'opus':
        return 'audio/opus';
      case 'otf':
        return 'font/otf';
      case 'pdf':
        return 'application/pdf';
      case 'php':
        return 'application/x-httpd-php';
      case 'ppt':
        return 'application/vnd.ms-powerpoint';
      case 'pptx':
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      case 'rar':
        return 'application/vnd.rar';
      case 'rtf':
        return 'application/rtf';
      case 'sh':
        return 'application/x-sh';
      case 'tar':
        return 'application/x-tar';
      case 'ts':
        return 'video/mp2t';
      case 'ttf':
        return 'font/ttf';
      case 'txt':
        return 'text/plain';
      case 'vsd':
        return 'application/vnd.visio';
      case 'wav':
        return 'audio/wav';
      case 'weba':
        return 'audio/webm';
      case 'webm':
        return 'video/webm';
      case 'woff':
        return 'font/woff';
      case 'woff2':
        return 'font/woff2';
      case 'xhtml':
        return 'application/xhtml+xml';
      case 'xls':
        return 'application/vnd.ms-excel';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'xml':
        return 'application/xml';
      case 'xul':
        return 'application/vnd.mozilla.xul+xml';
      case 'zip':
        return 'application/zip';
      case '3gp':
        return 'video/3gpp';
      case '3g2':
        return 'video/3gpp2';
      case '7z':
        return 'application/x-7z-compressed';

      default:
        return null;
    }
  }

  return null;
};
