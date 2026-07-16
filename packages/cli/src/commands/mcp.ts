// Copyright (C) 2026 Nucleic Logic Studios, LLC
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { ToolManifestSchema, readLockFile } from '@bitgenetics/aitools-core';
import type { TargetPlatform, LockEntry } from '@bitgenetics/aitools-core';
import { ConfigManager } from '../utils/config-manager.js';
import { createRegistryClient } from '../utils/registry-client.js';
import { Installer } from '../utils/installer.js';
import { transform, estimateCategoryConfidence } from '../transformers/index.js';
import { CLI_VERSION } from '../version.js';
import { resolveVsCodeUserMcpConfig } from '../adapters/vscode.js';

const SERVER_NAME = 'aitools';
const SERVER_ENTRY = {
  command: 'aitools',
  args: ['mcp'],
};

interface McpInstallOptions {
  user?: boolean;
}

interface PlatformMcpTarget {
  platform: TargetPlatform;
  configPath: string;
  serversKey: 'mcpServers' | 'servers';
}

/** Detect project-level platform config directories and return MCP targets. */
export function detectMcpTargets(cwd: string, userLevel: boolean): PlatformMcpTarget[] {
  const home = os.homedir();
  const candidates: PlatformMcpTarget[] = userLevel
    ? [
        { platform: 'cursor', configPath: path.join(home, '.cursor', 'mcp.json'), serversKey: 'mcpServers' },
        { platform: 'vscode', configPath: resolveVsCodeUserMcpConfig(home), serversKey: 'servers' },
        { platform: 'claude', configPath: path.join(home, '.claude.json'), serversKey: 'mcpServers' },
        { platform: 'windsurf', configPath: path.join(home, '.windsurf', 'mcp.json'), serversKey: 'mcpServers' },
      ]
    : [];

  if (!userLevel) {
    if (fs.existsSync(path.join(cwd, '.cursor'))) {
      candidates.push({ platform: 'cursor', configPath: path.join(cwd, '.cursor', 'mcp.json'), serversKey: 'mcpServers' });
    }
    if (fs.existsSync(path.join(cwd, '.vscode'))) {
      candidates.push({ platform: 'vscode', configPath: path.join(cwd, '.vscode', 'mcp.json'), serversKey: 'servers' });
    }
    if (fs.existsSync(path.join(cwd, '.claude')) || fs.existsSync(path.join(cwd, '.mcp.json'))) {
      candidates.push({ platform: 'claude', configPath: path.join(cwd, '.mcp.json'), serversKey: 'mcpServers' });
    }
    if (fs.existsSync(path.join(cwd, '.windsurf'))) {
      candidates.push({ platform: 'windsurf', configPath: path.join(cwd, '.windsurf', 'mcp.json'), serversKey: 'mcpServers' });
    }
  }

  return candidates;
}

export function writeMcpEntry(configPath: string, serversKey: 'mcpServers' | 'servers'): void {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  let config: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    } catch {
      throw new Error(`Cannot parse ${configPath}`);
    }
  }
  const servers = (config[serversKey] as Record<string, unknown> | undefined) ?? {};
  servers[SERVER_NAME] = { ...SERVER_ENTRY };
  config[serversKey] = servers;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
}

export function removeMcpEntry(configPath: string, serversKey: 'mcpServers' | 'servers'): boolean {
  if (!fs.existsSync(configPath)) return false;
  let config: Record<string, unknown>;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  } catch {
    return false;
  }
  const servers = config[serversKey] as Record<string, unknown> | undefined;
  if (!servers || !(SERVER_NAME in servers)) return false;
  delete servers[SERVER_NAME];
  config[serversKey] = servers;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return true;
}

async function runMcpServer(): Promise<void> {
  const cwd = process.cwd();
  const configManager = new ConfigManager(cwd);
  const installer = new Installer(configManager, cwd);
  const ctx: McpToolContext = { cwd, configManager, installer };

  const server = new Server(
    { name: 'aitools', version: CLI_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'aitools_install',
        description: 'Install a tool package for the active platform',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Package name' },
            version: { type: 'string', description: 'Optional semver version' },
            scope: { type: 'string', enum: ['project', 'user'], description: 'Install scope' },
          },
          required: ['name'],
        },
      },
      {
        name: 'aitools_search',
        description: 'Search the registry for tools',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
      },
      {
        name: 'aitools_compat',
        description: 'Run compatibility / transform confidence check for a manifest',
        inputSchema: {
          type: 'object',
          properties: {
            manifestPath: { type: 'string', description: 'Path to aitools.json (publish fields)' },
          },
          required: ['manifestPath'],
        },
      },
      {
        name: 'aitools_list',
        description: 'List installed tools from the lock file',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'aitools_uninstall',
        description: 'Remove an installed tool',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Package name' },
          },
          required: ['name'],
        },
      },
      {
        name: 'aitools_transform',
        description: 'Transform file content between platform formats',
        inputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            category: { type: 'string' },
            from: { type: 'string' },
            to: { type: 'string' },
            destPath: { type: 'string' },
          },
          required: ['content', 'category', 'from', 'to'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;
    const result = await handleMcpToolCall(name, args as Record<string, unknown> | undefined, ctx);
    return result as CallToolResult;
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export interface McpToolContext {
  cwd: string;
  configManager: ConfigManager;
  installer: Installer;
}

export interface McpToolResponse {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/** Dispatch a single MCP tool call — exported for unit tests. */
export async function handleMcpToolCall(
  name: string,
  args: Record<string, unknown> | undefined,
  ctx: McpToolContext,
): Promise<McpToolResponse> {
  const { cwd, configManager, installer } = ctx;
  try {
    switch (name) {
      case 'aitools_install': {
        const pkgName = String(args?.['name'] ?? '');
        const version = args?.['version'] as string | undefined;
        const scope = (args?.['scope'] as 'project' | 'user' | undefined) ?? 'project';
        const registries = configManager.getRegistries();
        if (registries.length === 0) {
          return toolError('No registries configured');
        }
        const client = createRegistryClient(registries[0]!);
        const manifest = await client.getManifest(pkgName, version ?? 'latest');
        const result = await installer.install(client, manifest, scope);
        return toolJson({
          name: result.name,
          version: result.version,
          files: result.fileResults.map((f) => ({
            dest: f.dest,
            skipped: f.skipped ?? false,
            confidence: f.transform?.confidence,
            warnings: f.transform?.warnings,
            skillPrompt: f.transform?.skillPrompt,
          })),
        });
      }
      case 'aitools_search': {
        const query = String(args?.['query'] ?? '');
        const registries = configManager.getRegistries();
        if (registries.length === 0) {
          return toolError('No registries configured');
        }
        const client = createRegistryClient(registries[0]!);
        const results = await client.search(query);
        return toolJson({ results });
      }
      case 'aitools_compat': {
        const manifestPath = path.resolve(String(args?.['manifestPath'] ?? ''));
        const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
        const parsed = ToolManifestSchema.safeParse(raw);
        if (!parsed.success) {
          return toolError('Invalid manifest');
        }
        const manifest = parsed.data;
        const source = manifest.nativeFor ?? 'universal';
        const platforms: TargetPlatform[] = ['cursor', 'vscode', 'claude', 'windsurf'];
        const matrix = platforms.map((p) => ({
          platform: p,
          category: manifest.category,
          confidence: estimateCategoryConfidence(manifest.category, source, p),
        }));
        return toolJson({ name: manifest.name, nativeFor: source, matrix });
      }
      case 'aitools_list': {
        const lock = readLockFile(cwd);
        const tools = Object.entries(lock.tools).map(([entryName, entry]: [string, LockEntry]) => ({
          name: entryName,
          version: entry.version,
          category: entry.category,
          platform: entry.platform,
        }));
        return toolJson({ tools });
      }
      case 'aitools_uninstall': {
        const pkgName = String(args?.['name'] ?? '');
        const removed = installer.uninstall(pkgName);
        return toolJson({ removed: removed.map((p) => path.relative(cwd, p).replace(/\\/g, '/')) });
      }
      case 'aitools_transform': {
        const content = String(args?.['content'] ?? '');
        const category = String(args?.['category'] ?? 'skill');
        const from = args?.['from'] as TargetPlatform;
        const to = args?.['to'] as TargetPlatform;
        const destPath = args?.['destPath'] as string | undefined;
        const result = transform(content, category as never, from, to, { destPath });
        return toolJson(result);
      }
      default:
        return toolError(`Unknown tool: ${name}`);
    }
  } catch (err) {
    return toolError((err as Error).message);
  }
}

function toolJson(data: unknown): McpToolResponse {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(message: string): McpToolResponse {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

export function createMcpCommand(): Command {
  const cmd = new Command('mcp')
    .description('Run aitools as an MCP stdio server or manage MCP config entries');

  cmd
    .command('install')
    .description('Add aitools MCP server entry to detected platform config files')
    .option('--user', 'Write to user-level MCP configs instead of project-level')
    .action((options: McpInstallOptions) => {
      const cwd = process.cwd();
      const targets = detectMcpTargets(cwd, Boolean(options.user));
      if (targets.length === 0) {
        console.log(chalk.yellow('No platform directories detected.'));
        console.log(chalk.dim('Create .cursor/, .vscode/, .claude/, or .windsurf/ first, or use --user.'));
        return;
      }
      for (const target of targets) {
        writeMcpEntry(target.configPath, target.serversKey);
        console.log(chalk.green(`Added aitools MCP entry to ${target.configPath}`));
      }
    });

  cmd
    .command('remove')
    .description('Remove aitools MCP server entry from detected platform config files')
    .option('--user', 'Remove from user-level MCP configs')
    .action((options: McpInstallOptions) => {
      const cwd = process.cwd();
      const targets = detectMcpTargets(cwd, Boolean(options.user));
      let removed = 0;
      for (const target of targets) {
        if (removeMcpEntry(target.configPath, target.serversKey)) {
          console.log(chalk.green(`Removed aitools MCP entry from ${target.configPath}`));
          removed++;
        }
      }
      if (removed === 0) {
        console.log(chalk.dim('No aitools MCP entries found to remove.'));
      }
    });

  cmd.action(async () => {
    await runMcpServer();
  });

  return cmd;
}
