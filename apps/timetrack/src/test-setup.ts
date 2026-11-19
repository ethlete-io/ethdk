import { DayBuildMessage } from './app/day-build/day-build';

/**
 * Stands in for the browser's `Worker`, which Node lacks: it runs the day build worker's handler after
 * the posting task, and clones both ways as `postMessage` does, so a value that cannot cross fails here.
 */
class InProcessDayBuildWorker extends EventTarget {
  postMessage(message: DayBuildMessage) {
    // eslint-disable-next-line ethlete/prefer-clone-equal -- postMessage's own algorithm is the one under test
    const sent = structuredClone(message);

    import('./app/day-build/day-build').then(({ replyTo }) => {
      // eslint-disable-next-line ethlete/prefer-clone-equal -- postMessage's own algorithm is the one under test
      const reply = structuredClone(replyTo(sent));

      this.dispatchEvent(new MessageEvent('message', { data: reply }));
    });
  }

  terminate() {
    return;
  }
}

globalThis.Worker = InProcessDayBuildWorker as unknown as typeof Worker;
