import * as core from "@actions/core";
import type { SlackMessages, SlackPayload } from "./slack.ts";

type PostOptions = {
  token: string;
  fetch?: typeof globalThis.fetch;
  delayMs?: number;
};

type SlackResponse = { ok: boolean; ts?: string; error?: string };

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function postMessage(
  body: SlackPayload & { thread_ts?: string },
  { token, fetch = globalThis.fetch, delayMs = 1000 }: PostOptions,
): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after")) || 1;
      await sleep(Math.max(retryAfter * 1000, delayMs));
      continue;
    }
    const result = (await response.json()) as SlackResponse;
    if (!result.ok || !result.ts) {
      throw new Error(result.error ?? `HTTP ${response.status}`);
    }
    return result.ts;
  }
}

export async function postSlackMessages(
  messages: SlackMessages,
  options: PostOptions,
): Promise<boolean> {
  let ts: string;
  try {
    ts = await postMessage(messages.main, options);
  } catch (err) {
    core.warning(`Slack release message failed: ${(err as Error).message}`);
    return false;
  }

  let ok = true;
  for (const reply of messages.thread) {
    try {
      await sleep(options.delayMs ?? 1000);
      await postMessage({ ...reply, thread_ts: ts }, options);
    } catch (err) {
      ok = false;
      core.warning(
        `Slack thread reply "${reply.text}" failed: ${(err as Error).message}`,
      );
    }
  }
  return ok;
}
