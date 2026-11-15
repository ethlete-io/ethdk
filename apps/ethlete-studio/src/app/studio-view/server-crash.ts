import { DesignServerCrash } from '../../host/design';
import { ServerCrash } from '../design-parts/shell-main/shell-main.component';

const CRASH_TIME = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export const serverCrashOf = (crash: DesignServerCrash | null): ServerCrash | null => {
  if (!crash) return null;

  const date = new Date(crash.time);

  return { ...crash, time: Number.isNaN(date.getTime()) ? crash.time : CRASH_TIME.format(date) };
};
