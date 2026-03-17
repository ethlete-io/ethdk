export type VimeoWindow = Window & {
  Vimeo: {
    Player: new (element: HTMLElement | string, options: VimeoPlayerOptions) => VimeoPlayer;
  };
};

export type VimeoPlayerOptions = {
  id?: number | string;
  url?: string;
  width?: number | string;
  height?: number | string;
  responsive?: boolean;
  autopause?: boolean;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
};

export type VimeoPlayer = {
  play(): Promise<void>;
  pause(): Promise<void>;
  getMuted(): Promise<boolean>;
  setMuted(muted: boolean): Promise<boolean>;
  getCurrentTime(): Promise<number>;
  getDuration(): Promise<number>;
  setCurrentTime(seconds: number): Promise<number>;
  on(event: string, callback: (data: unknown) => void): void;
  off(event: string, callback?: (data: unknown) => void): void;
  destroy(): Promise<void>;
  ready(): Promise<void>;
};

export type VimeoPlaybackEvent = {
  duration: number;
  percent: number;
  seconds: number;
};
