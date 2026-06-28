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
/**
 * E2E contract tests for the config layer model:
 *
 * - Settings (registries, platform, defaultScope, installPaths) write to user config by default;
 *   --project writes ./aitools.config.json; reads merge with project overriding user.
 * - Installed tools default to project scope; -g / --global installs to user scope.
 *
 * aitools.json and aitools-lock.json are project manifests (like package.json / package-lock.json).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  E2E_USER_CONFIG,
  REGISTRY_URL,
  clearE2eUserConfig,
  makeE2eProjectDir,
  publishFixture,
  rmTmpDir,
  run,
} from './test-env.js';

const FIXTURE = 'config-layers-install-fixture';

function projectConfigPath(projectDir: string): string {
  return path.join(projectDir, 'aitools.config.json');
}

describe('config layer model', () => {
  let projectDir: string;

  beforeAll(async () => {
    await publishFixture(FIXTURE, '1.0.0');
  });

  beforeEach(() => {
    projectDir = makeE2eProjectDir('aitools-config-layers-');
    clearE2eUserConfig();
    fs.writeFileSync(
      E2E_USER_CONFIG,
      JSON.stringify({
        registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
      }),
    );
  });

  afterEach(() => {
    rmTmpDir(projectDir);
    clearE2eUserConfig();
  });

  describe('settings write target', () => {
    it('writes config set to user config by default', () => {
      run('config set platform vscode', projectDir);
      expect(fs.existsSync(projectConfigPath(projectDir))).toBe(false);
      const userCfg = JSON.parse(fs.readFileSync(E2E_USER_CONFIG, 'utf8')) as { platform?: string };
      expect(userCfg.platform).toBe('vscode');
    });

    it('writes config set to project config with --project', () => {
      run('config set platform cursor --project', projectDir);
      const projectCfg = JSON.parse(fs.readFileSync(projectConfigPath(projectDir), 'utf8')) as {
        platform?: string;
      };
      expect(projectCfg.platform).toBe('cursor');
    });

    it('writes registry add to user config by default', () => {
      run('registry add http://extra.example.com --name extra-reg', projectDir);
      expect(fs.existsSync(projectConfigPath(projectDir))).toBe(false);
      const userCfg = JSON.parse(fs.readFileSync(E2E_USER_CONFIG, 'utf8')) as {
        registries: Array<{ name: string }>;
      };
      expect(userCfg.registries.some((r) => r.name === 'extra-reg')).toBe(true);
    });

    it('writes registry add to project config with --project', () => {
      run('registry add http://project-only.example.com --name project-reg --project', projectDir);
      const projectCfg = JSON.parse(fs.readFileSync(projectConfigPath(projectDir), 'utf8')) as {
        registries: Array<{ name: string }>;
      };
      expect(projectCfg.registries.some((r) => r.name === 'project-reg')).toBe(true);
    });

    it('removes registry from user config by default', () => {
      run('registry add http://remove-me.example.com --name remove-me', projectDir);
      run('registry remove remove-me', projectDir);
      const userCfg = JSON.parse(fs.readFileSync(E2E_USER_CONFIG, 'utf8')) as {
        registries: Array<{ name: string }>;
      };
      expect(userCfg.registries.some((r) => r.name === 'remove-me')).toBe(false);
    });

    it('removes registry from project config with --project', () => {
      run('registry add http://project-rm.example.com --name project-rm --project', projectDir);
      run('registry remove project-rm --project', projectDir);
      const projectCfg = JSON.parse(fs.readFileSync(projectConfigPath(projectDir), 'utf8')) as {
        registries: Array<{ name: string }>;
      };
      expect(projectCfg.registries.some((r) => r.name === 'project-rm')).toBe(false);
    });

    it('unsets config keys from user config by default', () => {
      run('config set platform vscode', projectDir);
      run('config unset platform', projectDir);
      const out = run('config get platform', projectDir);
      expect(out).toContain('not set');
    });

    it('unsets config keys from project config with --project', () => {
      fs.writeFileSync(projectConfigPath(projectDir), JSON.stringify({ platform: 'cursor' }), 'utf8');
      run('config unset platform --project', projectDir);
      const projectCfg = JSON.parse(fs.readFileSync(projectConfigPath(projectDir), 'utf8')) as Record<
        string,
        unknown
      >;
      expect(projectCfg['platform']).toBeUndefined();
    });
  });

  describe('settings cascade read', () => {
    it('returns project value when both user and project define platform', () => {
      fs.writeFileSync(E2E_USER_CONFIG, JSON.stringify({ platform: 'vscode' }), 'utf8');
      fs.writeFileSync(projectConfigPath(projectDir), JSON.stringify({ platform: 'cursor' }), 'utf8');
      const out = run('config get platform', projectDir);
      expect(out.trim()).toBe('cursor');
    });

    it('merges registries from user and project with project entries taking precedence by name', () => {
      fs.writeFileSync(
        E2E_USER_CONFIG,
        JSON.stringify({
          registries: [{ name: 'shared', url: 'http://user.example.com', priority: 10 }],
        }),
        'utf8',
      );
      fs.writeFileSync(
        projectConfigPath(projectDir),
        JSON.stringify({
          registries: [{ name: 'shared', url: 'http://project.example.com', priority: 1 }],
        }),
        'utf8',
      );
      const out = run('registry list', projectDir);
      expect(out).toContain('shared');
      expect(out).toContain('project.example.com');
    });
  });

  describe('install scope', () => {
    it('installs to project scope by default', () => {
      run(`install ${FIXTURE}`, projectDir);
      const lock = JSON.parse(fs.readFileSync(path.join(projectDir, 'aitools-lock.json'), 'utf8')) as {
        tools: Record<string, { scope?: string }>;
      };
      expect(lock.tools[FIXTURE]?.scope).toBe('project');
    });

    it('installs to user scope with --global', () => {
      run(`install ${FIXTURE} --global`, projectDir);
      const lock = JSON.parse(fs.readFileSync(path.join(projectDir, 'aitools-lock.json'), 'utf8')) as {
        tools: Record<string, { scope?: string }>;
      };
      expect(lock.tools[FIXTURE]?.scope).toBe('user');
    });

    it('uses defaultScope from merged config when --scope is omitted', () => {
      fs.writeFileSync(
        E2E_USER_CONFIG,
        JSON.stringify({
          registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
          defaultScope: 'user',
        }),
      );
      run(`install ${FIXTURE}`, projectDir);
      const lock = JSON.parse(fs.readFileSync(path.join(projectDir, 'aitools-lock.json'), 'utf8')) as {
        tools: Record<string, { scope?: string }>;
      };
      expect(lock.tools[FIXTURE]?.scope).toBe('user');
    });

    it('lets project defaultScope override user defaultScope on install', () => {
      fs.writeFileSync(
        E2E_USER_CONFIG,
        JSON.stringify({
          registries: [{ name: 'e2e-registry', url: REGISTRY_URL, priority: 1 }],
          defaultScope: 'user',
        }),
      );
      fs.writeFileSync(
        projectConfigPath(projectDir),
        JSON.stringify({ defaultScope: 'project' }),
      );
      run(`install ${FIXTURE}`, projectDir);
      const lock = JSON.parse(fs.readFileSync(path.join(projectDir, 'aitools-lock.json'), 'utf8')) as {
        tools: Record<string, { scope?: string }>;
      };
      expect(lock.tools[FIXTURE]?.scope).toBe('project');
    });
  });

  describe('flag validation', () => {
    it('rejects config set with both --project and --global', () => {
      expect(() => run('config set platform vscode --project --global', projectDir)).toThrow();
    });

    it('rejects registry add with both --project and --global', () => {
      expect(() =>
        run('registry add http://bad.example.com --name bad --project --global', projectDir),
      ).toThrow();
    });

    it('rejects install with both --global and --scope project', () => {
      expect(() => run(`install ${FIXTURE} --global --scope project`, projectDir)).toThrow();
    });
  });
});
