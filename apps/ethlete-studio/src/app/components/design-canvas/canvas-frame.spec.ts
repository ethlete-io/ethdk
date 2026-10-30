import { Subject } from 'rxjs';
import {
  MeasuredSide,
  cropPointOf,
  cropRectOf,
  croppedLayoutOf,
  followedSizes,
  frameMessageOf,
  pagePointOfCrop,
} from './canvas-frame';

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

describe('croppedLayoutOf', () => {
  it('enlarges a small area at most twice, so a button does not span the frame', () => {
    const { width, height, views } = croppedLayoutOf({
      areas: [{ x: 1300, y: 90, width: 72, height: 30 }],
      frame: { width: 1440, height: 900 },
    });

    expect(views).toEqual([
      { top: 204, scale: 2, width: 144, height: 60, area: { x: 1300, y: 90, width: 72, height: 30 } },
    ]);
    expect({ width, height }).toEqual({ width: 1440, height: 264 });
  });

  it('enlarges a wide area only up to the frame width', () => {
    const [view] = croppedLayoutOf({
      areas: [{ x: 0, y: 0, width: 960, height: 100 }],
      frame: { width: 1440, height: 900 },
    }).views;

    expect(view).toMatchObject({ scale: 1.5, width: 1440, height: 150 });
  });
});

describe('a crop of two areas', () => {
  const crop = {
    areas: [
      { x: 100, y: 200, width: 72, height: 54 },
      { x: 0, y: 800, width: 144, height: 36 },
    ],
    frame: { width: 1440, height: 900 },
  };
  const secondTop = 180 + 24 + 54 * 2 + 24;

  it('maps a page point into the area that shows it, and back', () => {
    expect(cropPointOf(crop, { x: 10, y: 810 })).toEqual({ x: 20, y: secondTop + 20 });
    expect(pagePointOfCrop(crop, { x: 20, y: secondTop + 20 })).toEqual({ x: 10, y: 810 });
    expect(pagePointOfCrop(crop, { x: 100, y: 204 })).toEqual({ x: 150, y: 200 });
  });

  it('cuts a rectangle to the first area that shows it', () => {
    expect(cropRectOf(crop, { x: 0, y: 800, width: 10, height: 5 })).toEqual({
      x: 0,
      y: secondTop,
      width: 20,
      height: 10,
    });
    expect(cropRectOf(crop, { x: 1000, y: 10, width: 10, height: 5 })).toBeNull();
  });
});
