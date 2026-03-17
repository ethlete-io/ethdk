export type FacebookVideoPlayer = {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  mute(): void;
  unmute(): void;
  isMuted(): boolean;
  getCurrentPosition(): number;
  getDuration(): number;
  subscribe(
    event: 'startedPlaying' | 'paused' | 'finishedPlaying' | 'startedBuffering' | 'finishedBuffering',
    handler: () => void,
  ): { release(): void };
};

export type FacebookWindow = Window & {
  FB: {
    Event: {
      subscribe(event: string, handler: (msg: unknown) => void): void;
      unsubscribe(event: string, handler: (msg: unknown) => void): void;
    };
    XFBML: {
      parse(element?: Element): void;
    };
  };
  fbAsyncInit?: () => void;
};
