import { AgentTools } from '../../host/agent';

export const toolsOf = (call: string, variant: string): AgentTools | null =>
  call.trim() && variant.trim() ? { call: call.trim(), variant: variant.trim() } : null;

export const promptFor = (prompt: string, tools: AgentTools | null) =>
  tools
    ? `You work on the call ${tools.call}, variant ${tools.variant}. Pass call "${tools.call}" and variant ` +
      `"${tools.variant}" to the studio tools.\n\n${prompt}`
    : prompt;
