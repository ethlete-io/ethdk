import { describe, expect, it } from 'vitest';
import { DEFAULT_EXCLUSION_RULES } from '../store/exclusion';
import { DEFAULT_TIMETRACK_SETTINGS, TimetrackSettings } from './model';
import {
  DEFAULT_NO_WORK_CONTEXT_APPS,
  DEFAULT_TRANSIENT_APPS,
  effectiveExclusionRules,
  effectiveNoWorkContextApps,
  effectiveTransientApps,
} from './rules';

const settingsWith = (patch: Partial<TimetrackSettings>): TimetrackSettings => ({
  ...DEFAULT_TIMETRACK_SETTINGS,
  ...patch,
});

describe('effectiveExclusionRules', () => {
  it('keeps the shipped defaults beside the user rules', () => {
    const rules = effectiveExclusionRules(settingsWith({ exclusionRules: [{ kind: 'app-id', appId: 'signal' }] }));

    expect(rules).toHaveLength(DEFAULT_EXCLUSION_RULES.length + 1);
    expect(rules).toContainEqual({ kind: 'app-id', appId: 'signal' });
  });

  it('drops the defaults only when they were turned off', () => {
    expect(
      effectiveExclusionRules(
        settingsWith({ keepDefaultExclusionRules: false, exclusionRules: [{ kind: 'app-id', appId: 'signal' }] }),
      ),
    ).toEqual([{ kind: 'app-id', appId: 'signal' }]);
  });

  it('folds a user rule that repeats a default into one', () => {
    const rules = effectiveExclusionRules(
      settingsWith({ exclusionRules: [{ kind: 'app-id', appId: 'ORG.KEEPASSXC.KEEPASSXC' }] }),
    );

    expect(rules).toHaveLength(DEFAULT_EXCLUSION_RULES.length);
  });
});

describe('effectiveNoWorkContextApps', () => {
  it('ships a media player and a messenger, and never Discord', () => {
    const apps = effectiveNoWorkContextApps(settingsWith({}));

    expect(apps).toContain('spotify');
    expect(apps).toContain('com.slack.Slack');
    expect(apps).not.toContain('discord');
  });

  it('adds the user statements to the shipped ones, without repeating either', () => {
    const apps = effectiveNoWorkContextApps(settingsWith({ noWorkContextApps: ['discord', 'spotify'] }));

    expect(apps).toContain('discord');
    expect(apps.filter((app) => app === 'spotify')).toHaveLength(1);
  });

  it('lets one application be taken back off the shipped list, and leaves the rest of it', () => {
    const apps = effectiveNoWorkContextApps(settingsWith({ holdsWorkApps: ['com.slack.Slack'] }));

    expect(apps).not.toContain('com.slack.Slack');
    expect(apps).toContain('spotify');
    expect(apps).toContain('com.microsoft.teams');
  });

  it('reads the taking back whatever case the user wrote it in', () => {
    expect(effectiveNoWorkContextApps(settingsWith({ holdsWorkApps: ['SPOTIFY'] }))).not.toContain('spotify');
  });

  it('lets a statement of the users own be taken back too', () => {
    const settings = settingsWith({ noWorkContextApps: ['obsidian'], holdsWorkApps: ['obsidian'] });

    expect(effectiveNoWorkContextApps(settings)).not.toContain('obsidian');
  });

  it('ships no application twice', () => {
    expect(new Set(DEFAULT_NO_WORK_CONTEXT_APPS).size).toBe(DEFAULT_NO_WORK_CONTEXT_APPS.length);
  });

  it('ships nothing that is also transient chrome', () => {
    const transient = new Set(DEFAULT_TRANSIENT_APPS);

    expect(DEFAULT_NO_WORK_CONTEXT_APPS.filter((app) => transient.has(app))).toEqual([]);
  });
});

describe('effectiveTransientApps', () => {
  it('ships the desktop portals', () => {
    expect(effectiveTransientApps(settingsWith({}))).toContain('xdg-desktop-portal-gnome');
  });

  it('lets one be taken back off the list, and leaves the rest of it', () => {
    const apps = effectiveTransientApps(settingsWith({ holdsWorkApps: ['XDG-DESKTOP-PORTAL-GNOME'] }));

    expect(apps).not.toContain('xdg-desktop-portal-gnome');
    expect(apps).toContain('xdg-desktop-portal-kde');
  });
});
