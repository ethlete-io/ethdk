import { DesignQueue } from '../../host/design-queue';

export const RECENT_FAILURE_MS = 10 * 60 * 1000;

/** The footer line of a busy render queue, such as `3 queued · 1 rendering · 12 s`, or `''` when it is idle. */
export const queueLineOf = (queue: DesignQueue | null) => {
  if (!queue || queue.queued + queue.rendering === 0) return '';

  return [
    queue.queued ? `${queue.queued} queued` : '',
    queue.rendering ? `${queue.rendering} rendering` : '',
    queue.oldestMs === null ? '' : `${Math.floor(queue.oldestMs / 1000)} s`,
  ]
    .filter(Boolean)
    .join(' · ');
};

const frameLabelOf = (key: string) => {
  try {
    const [, search] = JSON.parse(key) as [string, string];
    const params = new URLSearchParams(search);

    return [`${params.get('product')}/${params.get('part')}`, params.get('state') ?? params.get('variant') ?? '']
      .filter(Boolean)
      .join(' · ');
  } catch {
    return key;
  }
};

/** One line per shot that failed in the last `RECENT_FAILURE_MS`, then one per canvas frame that shows an error. */
export const failuresOf = ({
  queue,
  failingFrames,
  now,
}: {
  queue: DesignQueue | null;
  failingFrames: readonly string[];
  now: number;
}) => [
  ...(queue?.failed ?? [])
    .filter((failure) => now - Date.parse(failure.at) < RECENT_FAILURE_MS)
    .map((failure) => `${failure.part} · ${failure.state} · ${failure.status} ${failure.message.split('\n')[0]}`),
  ...failingFrames.map((key) => `${frameLabelOf(key)} · frame shows an error`),
];
