import { describe, expect, it } from 'vitest';
import { STUDIO_LABELS } from './studio-labels';

describe('STUDIO_LABELS', () => {
  it('labels the Sketches variant button and its confirm Übernehmen', () => {
    expect(STUDIO_LABELS.sketches.merge).toBe('Übernehmen');
    expect(STUDIO_LABELS.sketches.mergeConfirm.confirm).toBe('Übernehmen');
  });

  it('names a span in minutes, then hours, then days', () => {
    const { since, agentRun } = STUDIO_LABELS.sketches;

    expect([since(59), since(60), since(1439), since(1440), since(2 * 1440 + 30)]).toEqual([
      'seit 59 Min',
      'seit 1 Std',
      'seit 23 Std',
      'seit 1 Tag',
      'seit 2 Tagen',
    ]);
    expect([agentRun.ago(5), agentRun.ago(130), agentRun.ago(3 * 1440)]).toEqual([
      'vor 5 Min',
      'vor 2 Std',
      'vor 3 Tagen',
    ]);
  });
});
