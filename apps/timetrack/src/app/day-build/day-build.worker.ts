import { DayBuildMessage, replyTo } from './day-build';

addEventListener('message', ({ data }: MessageEvent<DayBuildMessage>) => postMessage(replyTo(data)));
