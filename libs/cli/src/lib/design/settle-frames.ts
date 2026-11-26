import { awaitSettled, Browser, finished, heldAnimations } from './thumb';

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

export const settleFrames = async (page: Pick<Page, 'frames'>) => {
  for (const frame of page.frames()) {
    await awaitSettled(frame);
    await frame.evaluate(finished);
    await frame.evaluate(heldAnimations);
  }
};
