import { createObjectUrlHandle } from './object-url';

describe('createObjectUrlHandle', () => {
  beforeEach(() => {
    // jsdom has no object URLs.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('mints a URL for the object', () => {
    const blob = new Blob(['a']);

    expect(createObjectUrlHandle(blob).url).toBe('blob:test');
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  });

  it('revokes the URL it minted', () => {
    createObjectUrlHandle(new Blob(['a'])).revoke();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it('revokes once, however often it is called', () => {
    const handle = createObjectUrlHandle(new Blob(['a']));

    handle.revoke();
    handle.revoke();

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
