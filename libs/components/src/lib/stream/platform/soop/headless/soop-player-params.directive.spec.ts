import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../../../test-helpers';
import { SoopPlayerParamsDirective } from './soop-player-params.directive';

@Component({
  selector: 'et-test-soop-params-host',
  template: '',
  hostDirectives: [{ directive: SoopPlayerParamsDirective, inputs: ['userId', 'videoId'] }],
})
class HostComponent {}

const setup = (inputs: { userId?: string; videoId?: string } = {}) => {
  const fixture = TestBed.createComponent(HostComponent);

  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);

  fixture.detectChanges();

  return fixture.debugElement.injector.get(SoopPlayerParamsDirective);
};

describe('SoopPlayerParamsDirective', () => {
  it('derives a live id from userId', () => {
    expect(setup({ userId: 'streamer' }).playerId()).toBe('soop-user-streamer');
  });

  it('derives a VOD id from videoId', () => {
    expect(setup({ videoId: '123' }).playerId()).toBe('soop-video-123');
  });

  it('prefers userId when both are set', () => {
    expect(setup({ userId: 'streamer', videoId: '123' }).playerId()).toBe('soop-user-streamer');
  });

  it('gives each slot without a source its own id', () => {
    const first = setup().playerId();

    expect(first).toMatch(/^soop-missing-/);
    expect(setup().playerId()).not.toBe(first);
  });
});
