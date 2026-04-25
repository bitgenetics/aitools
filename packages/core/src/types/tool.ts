/**
 * Tool categories supported by the ai-tools registry.
 * Each category has specific install behaviour and target paths.
 */
export type ToolCategory = 'skill' | 'subagent' | 'prompt' | 'mcp-tool';

/**
 * Where the tool is installed relative to the user's environment.
 * - project: installed inside the current project (tracked in source control)
 * - user:    installed for the current OS user (IDE-level, all projects)
 */
export type InstallScope = 'project' | 'user';

/**
 * Supported target platforms.
 * The installer adapts file paths and config formats to the selected platform.
 * - universal: .agents/ convention (default, tool-agnostic)
 * - vscode:    VS Code / GitHub Copilot
 * - claude:    Claude Code (Anthropic CLI)
 * - cursor:    Cursor IDE
 * - windsurf:  Windsurf IDE (Cognition)
 */
export type TargetPlatform = 'universal' | 'vscode' | 'claude' | 'cursor' | 'windsurf';

/**
 * A single file entry inside a tool package.
 * `src` is the path inside the published package archive.
 * `dest` is the file path relative to the category install directory.
 * The adapter resolves the category directory per platform (e.g. `.github/prompts/skills/`
 * for VS Code skills). `dest` should be just the filename or a subdirectory path
 * within that category dir - do NOT repeat the category name.
 * Example: for a skill, use `my-skill.md`, not `skills/my-skill.md`.
 */
export interface ToolFile {
  src: string;
  dest: string;
  /** When true the file is processed as a Handlebars template before writing. */
  template?: boolean;
}

/**
 * MCP server registration entry.
 * Used by mcp-tool packages to describe the server that should be registered
 * in the platform's mcp.json config file on install.
 */
export interface McpServerConfig {
  /** Shell command or path to the server executable. */
  command: string;
  /** Arguments to pass to the command. */
  args?: string[];
  /** Environment variables for the server process. */
  env?: Record<string, string>;
  /** For remote HTTP MCP servers. When set, `command` is ignored. */
  url?: string;
  /** Transport type. Defaults to 'stdio' for local servers. */
  type?: 'stdio' | 'http';
}

/**
 * The canonical manifest for a publishable ai-tool package.
 * This is stored as `ai-tools.manifest.json` at the root of a tool package
 * and served by the registry.
 */
export interface ToolManifest {
  /** Scoped or unscoped name, e.g. "@company/my-skill" or "my-skill". */
  name: string;
  /** Semver version string. */
  version: string;
  description: string;
  category: ToolCategory;
  /** Files included in this package. Required for non-mcp-tool categories. */
  files: ToolFile[];
  /**
   * MCP server registration descriptor.
   * Required when category is "mcp-tool"; ignored for other categories.
   */
  mcpServer?: McpServerConfig;
  keywords?: string[];
  author?: string;
  repository?: string;
  /** Other ai-tools packages this tool depends on. */
  dependencies?: Record<string, string>;
  /** Free-form metadata used for smart-find / AI discovery. */
  tags?: string[];
}

/**
 * Record of a tool that has been installed into a scope.
 * Persisted in ai-tools-lock.json.
 */
export interface InstalledTool {
  name: string;
  version: string;
  category: ToolCategory;
  scope: InstallScope;
  /** ISO-8601 timestamp of when this version was installed. */
  installedAt: string;
  /** Absolute paths of every file written during installation. */
  files: string[];
  /** Registry base URL the package was fetched from. */
  registry: string;
  /** SHA-256 integrity hash of the downloaded tarball. */
  integrity: string;
}
