import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { TwitchPlayerParamsDirective } from './twitch-player-params.directive';

@Component({
  selector: 'et-test-twitch-params-host',
  template: '',
  hostDirectives: [{ directive: TwitchPlayerParamsDirective, inputs: ['src', 'startTime'] }],
})
class HostComponent {}

const setup = (src: string) => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.componentRef.setInput('src', src);
  fixture.detectChanges();

  return fixture.debugElement.injector.get(TwitchPlayerParamsDirective);
};

describe('TwitchPlayerParamsDirective', () => {
  it.each([
    ['https://www.twitch.tv/league_live', 'league_live', null, 'twitch-channel-league_live'],
    ['twitch.tv/some_channel', 'some_channel', null, 'twitch-channel-some_channel'],
    ['bare_name', 'bare_name', null, 'twitch-channel-bare_name'],
    ['https://www.twitch.tv/videos/987', null, '987', 'twitch-video-987'],
    ['https://go.twitch.tv/video/42', null, '42', 'twitch-video-42'],
    ['123456', null, '123456', 'twitch-video-123456'],
  ])('parses %s', (src, channel, video, playerId) => {
    const params = setup(src);

    expect(params.channel()).toBe(channel);
    expect(params.video()).toBe(video);
    expect(params.playerId()).toBe(playerId);
  });

  it.each(['https://www.twitch.tv/videos/', 'https://example.com/live', 'not a channel', ''])(
    'resolves no source for %j',
    (src) => {
      const params = setup(src);

      expect(params.channel()).toBeNull();
      expect(params.video()).toBeNull();
      expect(params.playerId()).toMatch(/^twitch-missing-/);
    },
  );

  it('gives two slots without a source different player ids', () => {
    expect(setup('').playerId()).not.toBe(setup('').playerId());
  });
});
