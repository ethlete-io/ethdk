#!/usr/bin/env node
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline';
import { answerMcpLine } from './server.mts';

const lines = createInterface({ input: stdin, crlfDelay: Infinity });

for await (const line of lines) {
  const reply = await answerMcpLine(line);
  if (reply) stdout.write(`${JSON.stringify(reply)}\n`);
}
