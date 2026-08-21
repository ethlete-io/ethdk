import { describe, expect, it } from 'vitest';
import { ContainerState } from './compose';
import { serviceStateTable, serviceStates } from './state';

const container = (state: Partial<ContainerState>): ContainerState => ({
  id: 'abc123',
  name: 'ea-hub-app',
  service: 'app',
  status: 'Up 2 minutes',
  ports: [],
  ...state,
});

describe('serviceStates', () => {
  it('keeps the order the API declares', () => {
    const states = serviceStates({
      services: ['app', 'database'],
      containers: [container({ service: 'database' }), container({ service: 'app' })],
    });

    expect(states.map(({ service }) => service)).toEqual(['app', 'database']);
  });

  it('reports a service with no container', () => {
    const [state] = serviceStates({ services: ['app'], containers: [] });

    expect(state?.status).toBe('no container');
    expect(state?.running).toBe(false);
  });

  it('reads a stopped container as not running', () => {
    const [state] = serviceStates({
      services: ['app'],
      containers: [container({ status: 'Exited (1) 3 seconds ago' })],
    });

    expect(state?.running).toBe(false);
    expect(state?.status).toBe('Exited (1) 3 seconds ago');
  });

  it('names each published port mapping', () => {
    const [state] = serviceStates({
      services: ['s3mock'],
      containers: [
        container({
          service: 's3mock',
          ports: [
            { host: 8048, container: 9090 },
            { host: 8049, container: 9191 },
          ],
        }),
      ],
    });

    expect(state?.ports).toEqual(['8048 -> 9090', '8049 -> 9191']);
  });

  it('leaves out a container of another project', () => {
    const states = serviceStates({ services: ['app'], containers: [container({ service: 'other' })] });

    expect(states[0]?.status).toBe('no container');
  });
});

describe('serviceStateTable', () => {
  it('lines up the columns and drops the empty one', () => {
    const table = serviceStateTable([
      { service: 'app', status: 'Up 2 minutes', running: true, ports: ['8040 -> 80'] },
      { service: 'file-server', status: 'Exited (1)', running: false, ports: [] },
    ]);

    expect(table).toBe(['  app          Up 2 minutes  8040 -> 80', '  file-server  Exited (1)'].join('\n'));
  });

  it('answers an empty string for no services', () => {
    expect(serviceStateTable([])).toBe('');
  });
});
