ai-tools is an ai-tools registry system allowing for:
- tool discovery. skills, subagents, prompts, mcp tools
- tool installation. project level or IDE level. examples. skills can be either user or project space using universal spec. subagents, install into user or project space. etc. will support installing specific versions. 
- tool uninstall
- tool update
- tool smart-find, user describes what they need and ai agents reviews current registery details to help find best fits or combinations that will fill the needs.
- a registry spec
- user specificed registries allowing for public and private registries
- support an ai-tools.json and ai-tools-lock.json

the system will be composed of 2 major components.
- cli tool (like npm but for ai-tools) allows for project level and user level configuration. ai-tools.config.json. should cascade like npm does with .npmrc
- server - the registry, can be chained allowing for sever level registry combining.


