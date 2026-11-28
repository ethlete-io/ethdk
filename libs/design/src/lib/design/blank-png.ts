import { crc32, deflateSync } from 'zlib';

const chunkOf = (type: string, data: Buffer) => {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const head = Buffer.alloc(4);
  const tail = Buffer.alloc(4);

  head.writeUInt32BE(data.length);
  tail.writeUInt32BE(crc32(body));

  return Buffer.concat([head, body, tail]);
};

/** A fully transparent RGBA PNG of `width` x `height` pixels. */
export const blankPngOf = (width: number, height: number) => {
  const header = Buffer.alloc(13);

  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);

  const rows = Buffer.alloc((width * 4 + 1) * height);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunkOf('IHDR', header),
    chunkOf('IDAT', deflateSync(rows)),
    chunkOf('IEND', Buffer.alloc(0)),
  ]);
};
