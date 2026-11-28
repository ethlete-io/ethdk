import { defaultSettings } from '@ethlete/timetrack/testing';
import { E2E_NOW, expect, seedWorld, test } from './support';

test.describe('the agent setup row', () => {
  test('shows the adapter path this build ships and no checkout placeholder', async ({ page }) => {
    await seedWorld(page, {
      now: E2E_NOW,
      settings: defaultSettings(),
      agentMcpPath: '/opt/Timetrack/resources/timetrack-mcp.mjs',
    });
    await page.goto('/#/settings');
    await page.getByRole('tab', { name: 'Suggestions' }).click();

    const row = page.locator('[data-agent-mcp-setup]');

    await expect(row).toContainText('claude mcp add --scope user --transport stdio timetrack -- node /opt/Timetrack');
    await expect(row).toContainText('codex mcp add timetrack -- node /opt/Timetrack/resources/timetrack-mcp.mjs');
    await expect(row).not.toContainText('/path/to');
    await expect(row).not.toContainText('SDK checkout');
  });
});
