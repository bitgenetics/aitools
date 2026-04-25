import os from 'node:os';
import path from 'node:path';
import type { PlatformAdapter } from './types.js';
import type { ToolCategory, InstallScope } from '@ai-tools/core';

/**
 * Universal adapter — internal fallback used when no platform is configured.
 *
 * ~/.ai-tools/ is our tool's home directory on the user machine:
 *   cache/     ← downloaded tarballs, extracted to .agents/ structure
 *   tools/     ← user-scope installs when no IDE platform is set
 *
 * Project scope uses .agents/ (visible project-level fallback).
 * User scope uses ~/.ai-tools/tools/ (our dedicated home dir).
 *
 * Users should always set "platform" in ai-tools.config.json so files
 * land in the location their IDE expects.
 */
export class UniversalAdapter implements PlatformAdapter {
  readonly platform = 'universal' as const;

  private readonly DIRS: Record<InstallScope, Record<Exclude<ToolCategory, 'mcp-tool'>, string>> = {
    project: {
      skill:    path.join('.agents', 'skills'),
      subagent: path.join('.agents', 'agents'),
      prompt:   path.join('.agents', 'prompts'),
    },
    user: {
      skill:    path.join(os.homedir(), '.ai-tools', 'tools', 'skills'),
      subagent: path.join(os.homedir(), '.ai-tools', 'tools', 'agents'),
      prompt:   path.join(os.homedir(), '.ai-tools', 'tools', 'prompts'),
    },
  };

  resolveDir(category: Exclude<ToolCategory, 'mcp-tool'>, scope: InstallScope, cwd: string): string {
    const p = this.DIRS[scope][category];
    return scope === 'project' ? path.resolve(cwd, p) : p;
  }

  resolveMcpConfig(scope: InstallScope, cwd: string): string {
    if (scope === 'project') return path.resolve(cwd, '.agents', 'mcp.json');
    return path.join(os.homedir(), '.ai-tools', 'mcp.json');
  }
}

