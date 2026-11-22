// usage: node proxy-host.mjs <unix-socket> <refused-log> <allowed-host,...>
import { appendFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';

const [socketPath, refusedLog, allowList] = process.argv.slice(2);
const allowed = new Set(allowList.split(',').filter(Boolean));

const server = http.createServer((req, res) => {
  appendFileSync(refusedLog, `${new Date().toISOString()} refused ${req.method} ${req.url}\n`);
  res.writeHead(403).end();
});

server.on('connect', (req, client, head) => {
  const [host, port] = req.url.split(':');
  if (!allowed.has(host) || port !== '443') {
    appendFileSync(refusedLog, `${new Date().toISOString()} refused CONNECT ${req.url}\n`);
    client.end('HTTP/1.1 403 Forbidden\r\n\r\n');
    return;
  }
  const upstream = net.connect(443, host, () => {
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    upstream.write(head);
    upstream.pipe(client);
    client.pipe(upstream);
  });
  upstream.on('error', () => client.destroy());
  client.on('error', () => upstream.destroy());
  client.on('close', () => upstream.destroy());
});

rmSync(socketPath, { force: true });
server.listen(socketPath);
