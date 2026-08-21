import { createServer } from 'net';
import { describe, expect, it } from 'vitest';
import { portsInUse, publishedPorts } from './ports';

const PODMAN_COMPOSE_CONFIG = `networks:
  shared:
    external: true
    name: shared-fut
services:
  app:
    container_name: ea-hub-app
    image: hub-app
    ports:
    - 8040:80
    volumes:
    - ./..:/var/www/app
    - /home/tom/.composer:/root/.composer
  database:
    image: mysql:8.0
    ports:
    - 8041:3306
    volumes:
    - db-data:/var/lib/mysql:rw
  frontend:
    image: hub-frontend
    ports:
    - 8044:80
  s3mock:
    image: adobe/s3mock
    ports:
    - 8048:9090
    - 8049:9191
version: '3.4'
volumes:
  db-data: {}
`;

const DOCKER_COMPOSE_CONFIG = `name: development
services:
  app:
    container_name: ea-hub-app
    image: hub-app
    ports:
      - mode: ingress
        target: 80
        published: "8040"
        protocol: tcp
  database:
    image: mysql:8.0
    ports:
      - mode: ingress
        target: 3306
        published: "8041"
        protocol: tcp
  frontend:
    image: hub-frontend
    ports:
      - mode: ingress
        target: 80
        published: "8044"
        protocol: tcp
`;

describe('publishedPorts', () => {
  it('reads the short form podman-compose prints', () => {
    expect(publishedPorts({ config: PODMAN_COMPOSE_CONFIG, services: ['app', 'database', 's3mock'] })).toEqual([
      8040, 8041, 8048, 8049,
    ]);
  });

  it('reads the long form docker compose prints', () => {
    expect(publishedPorts({ config: DOCKER_COMPOSE_CONFIG, services: ['app', 'database'] })).toEqual([8040, 8041]);
  });

  it('leaves out a service the API does not start', () => {
    expect(publishedPorts({ config: PODMAN_COMPOSE_CONFIG, services: ['app'] })).toEqual([8040]);
    expect(publishedPorts({ config: DOCKER_COMPOSE_CONFIG, services: ['app'] })).toEqual([8040]);
  });

  it('reads no port for a service that is not in the file', () => {
    expect(publishedPorts({ config: PODMAN_COMPOSE_CONFIG, services: ['nope'] })).toEqual([]);
  });

  it('keeps a volume that looks like a port mapping out', () => {
    const config = `services:
  app:
    ports:
    - 8040:80
    volumes:
    - 1234:5678
`;

    expect(publishedPorts({ config, services: ['app'] })).toEqual([8040]);
  });

  it('reads the host port of an entry that names a bind address', () => {
    const config = `services:
  app:
    ports:
    - 127.0.0.1:8040:80
    - "[::1]:8041:80"
    - 8042:80/udp
`;

    expect(publishedPorts({ config, services: ['app'] })).toEqual([8040, 8041, 8042]);
  });

  it('reads no port for an entry that publishes no host port', () => {
    const config = `services:
  app:
    ports:
    - "80"
    - 8040-8049:80-89
`;

    expect(publishedPorts({ config, services: ['app'] })).toEqual([]);
  });

  it('reads nothing from a config without services', () => {
    expect(publishedPorts({ config: 'networks:\n  shared:\n    external: true\n', services: ['app'] })).toEqual([]);
  });
});

describe('portsInUse', () => {
  it('reports a port something already listens on', async () => {
    const server = createServer();

    await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));

    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;

    expect(await portsInUse([port])).toEqual([port]);

    await new Promise<void>((resolve) => server.close(() => resolve()));

    expect(await portsInUse([port])).toEqual([]);
  });

  it('reports nothing for an empty list', async () => {
    expect(await portsInUse([])).toEqual([]);
  });
});
