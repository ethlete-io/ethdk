import { Subject } from 'rxjs';
import { MeasuredSide, followedSizes, frameMessageOf } from './canvas-frame';

const followAPage = (contentAt: (viewport: number) => number, viewport: number) => {
  const measures$ = new Subject<MeasuredSide>();
  const followed: number[] = [];

  followedSizes(measures$).subscribe((size) => {
    followed.push(size);
    viewport = size;
    if (followed.length < 50 && contentAt(viewport) !== size) measures$.next({ size: contentAt(viewport), viewport });
  });
  measures$.next({ size: contentAt(viewport), viewport });

  return {
    followed,
    change: (next: (viewport: number) => number) => {
      contentAt = next;
      measures$.next({ size: contentAt(viewport), viewport });
    },
  };
};

describe('frameMessageOf', () => {
  it('reads that the frame will render asynchronously', () => {
    expect(frameMessageOf({ type: 'design-explore:loading' })).toEqual({ type: 'loading' });
  });

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

  it("reads the frame page's viewport", () => {
    expect(
      frameMessageOf({ type: 'design-explore:height', height: 96, viewport: { width: 320, height: 600 } }),
    ).toEqual({ type: 'height', height: 96, viewport: { width: 320, height: 600 } });
  });

  it('drops every other message', () => {
    expect(frameMessageOf({ type: 'design-explore:scroll', y: 40 })).toBeNull();
    expect(frameMessageOf({ type: 'design-explore:height', height: '412' })).toBeNull();
    expect(frameMessageOf('design-explore:escape')).toBeNull();
    expect(frameMessageOf(null)).toBeNull();
  });
});

describe('followedSizes', () => {
  it('settles a frame whose content is 100vh plus padding', () => {
    const { followed } = followAPage((viewport) => viewport + 32, 600);

    expect(followed).toEqual([632]);
  });

  it('follows content that does not grow with the frame', () => {
    const { followed, change } = followAPage(() => 412, 600);

    change(() => 380);

    expect(followed).toEqual([412, 380]);
  });

  it('follows content that grows after a settled 100vh frame', () => {
    const { followed, change } = followAPage((viewport) => viewport + 32, 600);

    change((viewport) => viewport + 164);

    expect(followed).toEqual([632, 796]);
  });

  it('follows every measure without a viewport', () => {
    const measures$ = new Subject<MeasuredSide>();
    const followed: number[] = [];

    followedSizes(measures$).subscribe((size) => followed.push(size));
    [632, 664, 696].forEach((size) => measures$.next({ size }));

    expect(followed).toEqual([632, 664, 696]);
  });
});
