import { createTypeahead } from './typeahead';

describe('createTypeahead', () => {
  it('appends lowercased characters and returns the accumulated buffer', () => {
    const typeahead = createTypeahead(50);

    expect(typeahead.append('A')).toBe('a');
    expect(typeahead.append('B')).toBe('ab');

    typeahead.destroy();
  });

  it('clears the buffer immediately on reset', () => {
    const typeahead = createTypeahead(50);

    typeahead.append('a');
    typeahead.reset();

    expect(typeahead.append('b')).toBe('b');

    typeahead.destroy();
  });

  it('clears the buffer on its own once the reset delay elapses', async () => {
    const typeahead = createTypeahead(20);

    typeahead.append('a');

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(typeahead.append('b')).toBe('b');

    typeahead.destroy();
  });

  it('extends the buffer instead of resetting it while appends keep arriving inside the delay', async () => {
    const typeahead = createTypeahead(60);

    typeahead.append('a');

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(typeahead.append('b')).toBe('ab');

    typeahead.destroy();
  });

  it('destroy resets the buffer the same way reset does', () => {
    const typeahead = createTypeahead(50);

    typeahead.append('a');
    typeahead.destroy();

    expect(typeahead.append('b')).toBe('b');
  });
});
