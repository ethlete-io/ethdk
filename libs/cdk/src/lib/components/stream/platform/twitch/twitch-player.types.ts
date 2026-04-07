export type TwitchEmbedPlayer = {
  play(): void;
  pause(): void;
  setMuted(muted: boolean): void;
  getMuted(): boolean;
  seek(timestamp: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  addEventListener(event: string, callback: () => void): void;
};

export type TwitchEmbed = {
  getPlayer(): TwitchEmbedPlayer;
  addEventListener(event: string, callback: () => void): void;
};

export type TwitchEmbedConstructor = {
  new (
    elementId: string | HTMLElement,
    options: {
      width: string | number;
      height: string | number;
      channel?: string;
      video?: string;
      parent?: string[];
      autoplay?: boolean;
      muted?: boolean;
      time?: string;
      layout?: 'video-with-chat' | 'video';
    },
  ): TwitchEmbed;
  READY: string;
  PLAY: string;
  PAUSE: string;
  ENDED: string;
};

export type TwitchWindow = Window & {
  Twitch?: { Embed: TwitchEmbedConstructor };
};

export type TwitchPlayerParams = {
  channel: string | null;
  video: string | null;
};
