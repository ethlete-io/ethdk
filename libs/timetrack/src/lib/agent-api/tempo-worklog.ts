import { tempoDay, tempoTimeOfDay } from '../tempo/wall-clock';
import { TempoWorklog } from '../tempo/worklogs';
import { AgentApiTempoWorklog } from './model';

export const toAgentApiTempoWorklog = (
  worklog: TempoWorklog,
  keysByIssueId: ReadonlyMap<string, string>,
): AgentApiTempoWorklog => ({
  id: worklog.id,
  day: tempoDay(worklog.from),
  startTime: tempoTimeOfDay(worklog.from).slice(0, 5),
  startMs: worklog.from.getTime(),
  durationMs: worklog.durationMs,
  issueKey: keysByIssueId.get(worklog.issueId),
  issueId: worklog.issueId,
  description: worklog.description,
});
