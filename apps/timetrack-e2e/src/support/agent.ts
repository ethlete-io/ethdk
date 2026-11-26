import { Page, expect } from '@playwright/test';
import { AgentApiAnswer } from '@ethlete/timetrack';
import { TIMETRACK_E2E_AGENT_KEY } from '@ethlete/timetrack/testing';

/**
 * Sends one request to the window's agent endpoint, as the `timetrack` CLI would, and answers what
 * the window replied. Waits for the window first: a request sent before the endpoint listens is lost.
 */
export const askAgent = async <T = unknown>(page: Page, body: Record<string, unknown>) => {
  await expect(page.locator('ethlete-root main')).toBeVisible();

  return page.evaluate(
    ([key, request]) =>
      ((globalThis as Record<string, unknown>)[key as string] as (body: unknown) => Promise<AgentApiAnswer<T>>)(
        request,
      ),
    [TIMETRACK_E2E_AGENT_KEY, body] as const,
  );
};

/** The id a queued write answered with, failing the spec where the write was not queued. */
export const queuedId = (answer: AgentApiAnswer) => {
  expect(answer).toEqual({ ok: true, value: { status: 'queued', approvalId: expect.any(String) } });

  return (answer as { value: { approvalId: string } }).value.approvalId;
};

/** Opens the short list of waiting requests the approval banner leads to. */
export const openApprovals = async (page: Page) => {
  await page.getByRole('button', { name: 'Review requests' }).click();

  const dialog = page.locator('ethlete-approval-queue');

  await expect(dialog).toBeVisible();

  return dialog;
};
