// usage: node proxy-forward.mjs <unix-socket> <port>
import net from 'node:net';

const [socketPath, port] = process.argv.slice(2);

net
  .createServer((client) => {
    const upstream = net.connect(socketPath);
    client.pipe(upstream);
    upstream.pipe(client);
    client.on('error', () => upstream.destroy());
    upstream.on('error', () => client.destroy());
    client.on('close', () => upstream.destroy());
    upstream.on('close', () => client.destroy());
  })
  .listen(Number(port), '127.0.0.1');
