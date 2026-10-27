import { frameMessageOf } from './canvas-frame';

describe('frameMessageOf', () => {
  it('reads the height the frame page reports', () => {
    expect(frameMessageOf({ type: 'design-explore:height', variant: 'default', height: 412 })).toEqual({
      type: 'height',
      height: 412,
    });
  });

  it('reads the width a frame that fits its content reports', () => {
    expect(frameMessageOf({ type: 'design-explore:height', variant: 'default', height: 96, width: 212 })).toEqual({
      type: 'height',
      height: 96,
      width: 212,
    });
  });

  it('reads that the frame page hit an error', () => {
    const href = 'http://localhost:1/frame.html?product=web&part=components%2Fbutton&state=solid';

    expect(
      frameMessageOf({ type: 'design-explore:height', variant: 'solid', height: 80, href, errored: true }),
    ).toEqual({ type: 'height', height: 80, href, errored: true });
  });

  it('reads an Esc from inside the frame', () => {
    expect(frameMessageOf({ type: 'design-explore:escape', variant: 'default' })).toEqual({ type: 'escape' });
  });

  it('drops every other message', () => {
    expect(frameMessageOf({ type: 'design-explore:scroll', y: 40 })).toBeNull();
    expect(frameMessageOf({ type: 'design-explore:height', height: '412' })).toBeNull();
    expect(frameMessageOf('design-explore:escape')).toBeNull();
    expect(frameMessageOf(null)).toBeNull();
  });
});
