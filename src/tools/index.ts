import type { McpServer } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from '../lib/api-client.js';
import type { KeyTier } from '../lib/tier.js';
import { registerListChecks } from './list-checks.js';
import { registerGetCheck } from './get-check.js';
import { registerListCheckPings } from './list-check-pings.js';
import { registerListIntegrations } from './list-integrations.js';

export function registerTools(server: McpServer, client: HealthchecksClient, tier: KeyTier): void {
  registerListChecks(server, client);
  registerGetCheck(server, client);
  registerListCheckPings(server, client, tier);
  registerListIntegrations(server, client, tier);
}
