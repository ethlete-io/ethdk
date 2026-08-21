import { describe, expect, it } from 'vitest';
import { agentCommand, assistedTasks } from './ai';
import { UpdateTask } from './tasks';

const task = (overrides: Partial<UpdateTask> = {}): UpdateTask => ({
  packageName: '@ethlete/core',
  name: 'a-change',
  version: '5.1.0',
  kind: 'assisted',
  description: 'Rewrite something',
  instructionsFile: '.ethlete/update/core-a-change.md',
  ...overrides,
});

describe('agentCommand', () => {
  it('puts the prompt where the template asks for it', () => {
    expect(agentCommand({ template: 'claude -p "work <prompt> now"', promptPath: '/repo/task.md' })).toBe(
      'claude -p "work /repo/task.md now"',
    );
  });

  it('appends the prompt when the template names no place for it', () => {
    expect(agentCommand({ template: 'claude -p', promptPath: '/repo/task.md' })).toBe('claude -p /repo/task.md');
  });

  it('quotes a path that holds a space', () => {
    expect(agentCommand({ template: 'claude -p', promptPath: '/my repo/task.md' })).toBe(
      'claude -p "/my repo/task.md"',
    );
  });
});

describe('assistedTasks', () => {
  it('takes only the assisted tasks that have a prompt', () => {
    const tasks = [
      task(),
      task({ name: 'manual-one', kind: 'manual' }),
      task({ name: 'no-prompt', instructionsFile: undefined }),
    ];

    expect(assistedTasks(tasks).map((entry) => entry.name)).toEqual(['a-change']);
  });
});
