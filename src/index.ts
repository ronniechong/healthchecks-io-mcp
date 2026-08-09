#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { DEFAULT_BASE_URL } from './config/constants.js';
import { detectKeyTier, type KeyTier } from './lib/tier.js';
import { registerTools } from './tools/index.js';
import { createServer, createClient } from './server/server-factory.js';

async function main() {
  const apiKey = process.env.HEALTHCHECKS_API_KEY;
  if (!apiKey) {
    console.error('HEALTHCHECKS_API_KEY environment variable is required.');
    process.exit(1);
  }

  // HEALTHCHECKS_BASE_URL is an internal test-only override (the client
  // already takes base URL as a parameter per decision #19) — not a
  // documented/public config option; real self-hosted support lands in
  // v1.1 as its own decision.
  const client = createClient(apiKey, process.env.HEALTHCHECKS_BASE_URL || DEFAULT_BASE_URL);
  let tier: KeyTier;
  try {
    tier = await detectKeyTier(client);
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Failed to detect Healthchecks.io API key tier.'
    );
    process.exit(1);
    return;
  }
  if (tier === 'read-only') {
    console.error(
      'Note: this Healthchecks.io API key is read-only. list_check_pings and list_integrations will not work with it.'
    );
  }

  const server = createServer();
  registerTools(server, client, tier);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
