import { InjectionToken, Signal } from '@angular/core';
import { StreamPlayerCapabilities, StreamPlayerState } from './stream.types';

export type StreamPlayer = {
  /** Capabilities of the player, e.g. whether it supports seeking. */
  readonly CAPABILITIES: StreamPlayerCapabilities;

  /**
   * Current state of the player, e.g. whether it's playing or paused.
   * Note that the state depends on the capabilities - e.g. a player that doesn't support seeking will always have currentTime = null.
   */
  state: Signal<StreamPlayerState>;

  /**
   * A reactive thumbnail URL for this player, or `null` if unavailable.
   * Only populated when `CAPABILITIES.hasThumbnail` is true.
   */
  thumbnail: Signal<string | null>;

  /** Start playback. No-op if already playing or if canPlay capability is false. */
  play(): void;

  /** Pause playback. No-op if already paused or if canPause capability is false. */
  pause(): void;

  /** Mute playback. No-op if already muted or if canMute capability is false. */
  mute(): void;

  /** Unmute playback. No-op if already unmuted or if canMute capability is false. */
  unmute(): void;

  /** Seek to time in seconds. No-op if canSeek capability is false. */
  seek(seconds: number): void;

  /** Reload the player resource, e.g. after a script load failure. */
  retry(): void;
};

export const STREAM_PLAYER_TOKEN = new InjectionToken<StreamPlayer>('STREAM_PLAYER_TOKEN');
