export const inferMimeType = (srcset: string) => {
  if (!srcset) return null;

  const urls = srcset.split(',').map((item) => item.trim().split(' ')[0]);
  const firstUrl = urls[0];

  const fileExtensionMatch = firstUrl?.match(/\.(.*)$/);

  if (fileExtensionMatch && fileExtensionMatch.length > 1) {
    const fileExtension = fileExtensionMatch[1]?.toLowerCase();

    switch (fileExtension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'bmp':
        return 'image/bmp';
      default:
        return null;
    }
  }

  return null;
};
