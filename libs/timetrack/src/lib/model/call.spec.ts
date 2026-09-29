import { CallWindow, appDisplayNameOf, callExclusionReasonOf, countsAsWorkPatternOf } from './call';

const window = (over: Partial<CallWindow>): CallWindow => ({
  from: new Date(0),
  to: new Date(60_000),
  appId: 'com.slack.Slack',
  title: '',
  attendedMs: 60_000,
  countsAsWork: false,
  isPresence: true,
  ...over,
});

describe('appDisplayNameOf', () => {
  it('reads the application out of a reverse-domain id', () => {
    expect(appDisplayNameOf('com.slack.Slack')).toBe('Slack');
    expect(appDisplayNameOf('com.hnc.Discord.helper.Renderer')).toBe('Discord');
    expect(appDisplayNameOf('org.telegram.desktop')).toBe('Telegram');
  });

  it('title-cases a plain process name', () => {
    expect(appDisplayNameOf('google-chrome')).toBe('Google Chrome');
    expect(appDisplayNameOf('Discord')).toBe('Discord');
  });
});

describe('callExclusionReasonOf', () => {
  it('says no rule counts a call default-deny left out', () => {
    expect(callExclusionReasonOf(window({ excludedBy: 'no-rule' }))).toBe('Slack, no rule counts it as work');
  });

  it('says a rule excluded a call a deny rule matched', () => {
    expect(callExclusionReasonOf(window({ excludedBy: 'deny-rule' }))).toBe('Slack, a rule excludes it');
  });

  it('says nobody was in front of a room left open', () => {
    expect(callExclusionReasonOf(window({ excludedBy: 'unattended' }))).toBe('Slack, never in front');
  });

  it('gives no reason for a call that counts', () => {
    expect(callExclusionReasonOf(window({ countsAsWork: true }))).toBeUndefined();
  });
});

describe('countsAsWorkPatternOf', () => {
  it('matches the application id itself and nothing looser', () => {
    const pattern = new RegExp(countsAsWorkPatternOf('com.slack.Slack'), 'i');

    expect(pattern.test('com.slack.Slack')).toBe(true);
    expect(pattern.test('comXslackXSlack')).toBe(false);
  });
});
