// Copyright (C) 2026 Michael Benjamin (turbofoxwave@gmail.com)
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
import type { AiToolsConfig, RegistryConfig } from '../types/config.js';
import { AiToolsConfigSchema } from '../schema/config-schema.js';

export const CONFIG_FILENAME = 'aitools.config.json';

/**
 * Config cascade ? mirrors npm's .npmrc lookup:
 *   project root ? each parent directory ? user home ? system (process.env)
 *
 * Lower-level files win. Arrays (like registries) are merged with lower-level
 * entries prepended so they are queried first.
 */
export class ConfigCascade {
  /**
   * Load and merge all config files reachable from `cwd` up to the root,
   * then the user home config.
   */
  static load(cwd: string = process.cwd()): AiToolsConfig {
    const files = ConfigCascade.resolveConfigFiles(cwd);
    const layers = files
      .map((f) => ConfigCascade.readFile(f))
      .filter((c): c is AiToolsConfig => c !== null);

    return ConfigCascade.merge(layers);
  }

  /** Return ordered list of config file paths (project ? home). */
  static resolveConfigFiles(cwd: string): string[] {
    const paths: string[] = [];
    const configRoot = process.env['AITOOLS_CONFIG_ROOT'];

    // Walk up from cwd to filesystem root (or an optional boundary for tests)
    let dir = path.resolve(cwd);
    while (true) {
      paths.push(path.join(dir, CONFIG_FILENAME));
      if (configRoot && path.resolve(dir) === path.resolve(configRoot)) break;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    // User home
    const homePath = path.join(os.homedir(), CONFIG_FILENAME);
    if (!paths.includes(homePath)) {
      paths.push(homePath);
    }

    // Reverse so that home is the base; project overrides last
    return paths.reverse();
  }

  /** Read and validate a single config file, returns null if missing/invalid. */
  static readFile(filePath: string): AiToolsConfig | null {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed: unknown = JSON.parse(ConfigCascade.stripComments(raw));
      const result = AiToolsConfigSchema.safeParse(parsed);
      if (!result.success) {
        process.stderr.write(
          `[aitools] Warning: invalid config at ${filePath}: ${result.error.message}\n`,
        );
        return null;
      }
      return result.data;
    } catch {
      return null;
    }
  }

  /**
   * Strip // line comments and /* block comments *\/ from a JSON string.
   * Skips content inside quoted strings to avoid false positives.
   * Enables JSONC-style config files while keeping JSON.parse() as the parser.
   */
  static stripComments(src: string): string {
    let result = '';
    let i = 0;
    while (i < src.length) {
      // Inside a string ? copy verbatim until closing quote
      if (src[i] === '"') {
        result += src[i++];
        while (i < src.length) {
          const ch = src[i];
          result += ch;
          i++;
          if (ch === '\\') { result += src[i] ?? ''; i++; continue; }
          if (ch === '"') break;
        }
        continue;
      }
      // Line comment
      if (src[i] === '/' && src[i + 1] === '/') {
        while (i < src.length && src[i] !== '\n') i++;
        continue;
      }
      // Block comment
      if (src[i] === '/' && src[i + 1] === '*') {
        i += 2;
        while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
        i += 2;
        continue;
      }
      result += src[i++];
    }
    return result;
  }

  /**
   * Merge an ordered array of config layers (index 0 = lowest priority,
   * last index = highest priority / project-level).
   */
  static merge(layers: AiToolsConfig[]): AiToolsConfig {
    const result: AiToolsConfig = {};

    for (const layer of layers) {
      if (layer.defaultScope !== undefined) {
        result.defaultScope = layer.defaultScope;
      }
      if (layer.platform !== undefined) {
        result.platform = layer.platform;
      }
      if (layer.installPaths !== undefined) {
        result.installPaths = { ...(result.installPaths ?? {}), ...layer.installPaths };
      }
      if (layer.registries !== undefined) {
        // Higher-priority registries are prepended to the list
        result.registries = deduplicateRegistries([
          ...layer.registries,
          ...(result.registries ?? []),
        ]);
      }
    }

    return result;
  }
}

/** Remove duplicate registry entries by name, keeping the first occurrence. */
function deduplicateRegistries(registries: RegistryConfig[]): RegistryConfig[] {
  const seen = new Set<string>();
  return registries.filter((r) => {
    if (seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
}
