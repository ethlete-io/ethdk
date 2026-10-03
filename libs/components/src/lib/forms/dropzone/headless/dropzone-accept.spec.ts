import { isFileAccepted } from './dropzone-entry';

const file = (name: string, type: string) => new File(['x'], name, { type });

describe('isFileAccepted', () => {
  it('accepts everything for an empty or blank accept list', () => {
    expect(isFileAccepted(file('a.exe', 'application/x-msdownload'), '')).toBe(true);
    expect(isFileAccepted(file('a.exe', 'application/x-msdownload'), ' , ')).toBe(true);
  });

  it('matches extensions case-insensitively and only at the end of the name', () => {
    expect(isFileAccepted(file('PHOTO.PNG', ''), '.png')).toBe(true);
    expect(isFileAccepted(file('photo.png.exe', ''), '.png')).toBe(false);
    expect(isFileAccepted(file('archive.tar.gz', ''), '.tar.gz')).toBe(true);
  });

  it('matches a wildcard MIME type by its top-level type only', () => {
    expect(isFileAccepted(file('a.png', 'image/png'), 'image/*')).toBe(true);
    expect(isFileAccepted(file('a.png', 'imagery/png'), 'image/*')).toBe(false);
    expect(isFileAccepted(file('a', ''), 'image/*')).toBe(false);
    expect(isFileAccepted(file('a', ''), '*/*')).toBe(true);
  });

  it('matches exact MIME types case-insensitively within a mixed list', () => {
    expect(isFileAccepted(file('a.pdf', 'application/PDF'), ' image/* , Application/pdf ')).toBe(true);
    expect(isFileAccepted(file('a.txt', 'text/plain'), 'image/*, application/pdf, .png')).toBe(false);
  });
});
