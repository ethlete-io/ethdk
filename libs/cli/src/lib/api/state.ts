import { ContainerState, isRunningStatus } from './compose';

export type ServiceState = {
  service: string;
  /** The engine's own words, or `no container` for a service that was never created. */
  status: string;
  running: boolean;
  /** Published host ports, as `8000 -> 80`. */
  ports: string[];
};

const pad = (text: string, width: number) => text.padEnd(width);

/**
 * One row per requested service, in the order the API declares them. A container the engine knows
 * but this API does not ask for is left out, so a shared checkout does not pad the table.
 */
export const serviceStates = (options: {
  services: readonly string[];
  /** Containers of this compose project only. */
  containers: readonly ContainerState[];
}): ServiceState[] => {
  const { services, containers } = options;

  return services.map((service) => {
    const container = containers.find((candidate) => candidate.service === service);

    return {
      service,
      status: container?.status ?? 'no container',
      running: container !== undefined && isRunningStatus(container.status),
      ports: (container?.ports ?? []).map(({ host, container: target }) => `${host} -> ${target}`),
    };
  });
};

/** The state table `up` prints instead of the container engine's own wide one. */
export const serviceStateTable = (states: readonly ServiceState[]) => {
  const serviceWidth = Math.max(0, ...states.map(({ service }) => service.length));
  const statusWidth = Math.max(0, ...states.map(({ status }) => status.length));

  return states
    .map(({ service, status, ports }) =>
      `  ${pad(service, serviceWidth)}  ${pad(status, statusWidth)}  ${ports.join(', ')}`.trimEnd(),
    )
    .join('\n');
};
