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
 * Vendor file formats: how each platform spells rules, commands, agents and hooks, and
 * the conversions between them. Transformers, compat and publish all read this layer so
 * one table owns each vendor fact.
 */
export type { ContentVendor, VendorConversion, VendorField } from './types.js';
export { CONTENT_VENDORS, isContentVendor } from './types.js';
export type { FrontmatterDocument } from './frontmatter.js';
export { parseFrontmatter, serializeFrontmatter } from './frontmatter.js';
export { replaceVendorExtension } from './extensions.js';
export { convertRule, vendorRuleFields, RULE_EXTENSION } from './rule.js';
export { convertAgent, vendorAgentFields, agentsSupported, AGENT_EXTENSION } from './agent.js';
export { convertCommand, vendorCommandFields, COMMAND_EXTENSION } from './command.js';
export type { HookHandler, HookEvents, HooksFile, HookConversion } from './hooks.js';
export {
  HOOK_EVENTS,
  hookEventName,
  neutralHookEvent,
  readHooksFile,
  writeHooksFile,
  nonEmptyHookEvents,
  convertHookEvents,
  NO_PORTABLE_HOOKS_WARNING,
  WINDSURF_HOOKS_UNVERIFIED_WARNING,
} from './hooks.js';
export type { FrontmatterCategory } from './detect.js';
export { detectVendorFrontmatter } from './detect.js';
