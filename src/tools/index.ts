import type { McpServer } from '@modelcontextprotocol/server';
import type { HealthchecksClient } from '../lib/api-client.js';
import type { KeyTier } from '../lib/tier.js';
import { registerListChecks } from './list-checks.js';
import { registerGetCheck } from './get-check.js';
import { registerListCheckPings } from './list-check-pings.js';
import { registerListIntegrations } from './list-integrations.js';
import { registerCreateCheck } from './create-check.js';
import { registerUpdateCheck } from './update-check.js';
import { registerPauseCheck } from './pause-check.js';
import { registerResumeCheck } from './resume-check.js';
import { registerDeleteCheck } from './delete-check.js';
import { registerListCheckFlips } from './list-check-flips.js';
import { registerListBadges } from './list-badges.js';

export function registerTools(server: McpServer, client: HealthchecksClient, tier: KeyTier): void {
  registerListChecks(server, client);
  registerGetCheck(server, client);
  registerListCheckPings(server, client, tier);
  registerListIntegrations(server, client, tier);
  registerCreateCheck(server, client, tier);
  registerUpdateCheck(server, client, tier);
  registerPauseCheck(server, client, tier);
  registerResumeCheck(server, client, tier);
  registerDeleteCheck(server, client, tier);
  registerListCheckFlips(server, client);
  registerListBadges(server, client);
}
