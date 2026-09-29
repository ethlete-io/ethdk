import { RemovedExport } from '../removed-exports/removed-exports.js';

export const YOUTUBE_PLAYER_SLOT_DIRECTIVE_REMOVALS: readonly RemovedExport[] = [
  {
    name: 'YoutubePlayerSlotDirective',
    dropFromArrays: ['imports'],
    todo: 'YoutubePlayerSlotDirective is removed. Render <et-youtube-player-slot> (YoutubePlayerSlotComponent) or build a slot with createStreamPlayerSlot.',
  },
  {
    name: 'YOUTUBE_PLAYER_SLOT_TOKEN',
    todo: 'YOUTUBE_PLAYER_SLOT_TOKEN is removed. Query YoutubePlayerSlotComponent instead, or read the slot through STREAM_SLOT_PLAYER_ID_TOKEN.',
  },
];
