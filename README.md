# claude-skills

Skills for [Claude](https://claude.com), published as a Claude Code plugin marketplace.

## Install (Claude Code)

```
/plugin marketplace add theboyknowsclass/claude-skills
/plugin install <plugin>@claude-skills
```

## Install (Claude app)

Download a skill's zip from [Releases](https://github.com/theboyknowsclass/claude-skills/releases) and upload it under **Settings > Capabilities > Skills**.

## Skills

| Plugin | What it does |
| --- | --- |
| [gridfinity](plugins/gridfinity) | Gridfinity bins (form-fit pocketed or hollow) and baseplates (open frame or magnet) in [SolidCraft](https://github.com/tangency-labs/solidcraft) over MCP. Personalise with a [preferences file](plugins/gridfinity/gridfinity-preferences.example.md). |
| [cad-setup](plugins/cad-setup) | Installs and wires up CAD tools for Claude over MCP: [SolidCraft](https://github.com/tangency-labs/solidcraft) (headless and live), its Gridfinity plugin, FreeCAD with [freecad-mcp](https://github.com/neka-nat/freecad-mcp), and a weekly SolidCraft auto-update. Windows and macOS, with Linux notes. Personalise with a [preferences file](plugins/cad-setup/cad-setup-preferences.example.md). |
| [model-files](plugins/model-files) | A side panel (mod) listing the newest model files in a folder you choose, with buttons to open each in its default app or show it in Explorer/Finder. For local Claude Code sessions on Windows and macOS. |

## Layout

```
.claude-plugin/marketplace.json     # lists the plugins
plugins/<plugin>/.claude-plugin/plugin.json
plugins/<plugin>/skills/<skill>/SKILL.md
plugins/<plugin>/hooks/register.tsx  # a mod (hooks module) instead of a skill
```
