# model-files

A Claude Code mod that keeps a **Model files** panel beside the chat. It lists the newest model files in a folder you choose (searched recursively), newest first, and gives each one two buttons:

- **the file name**: opens the file in your operating system's default app for that type (for example a slicer for `.3mf`).
- **Folder**: shows the file selected in Explorer (Windows) or Finder (macOS).

It rescans every 20 seconds, and has a **Refresh** button. Useful when Claude exports files during a session and chat links to local files are not clickable.

## Install

From a terminal Claude Code session on the machine that has the files:

```
/plugin marketplace add theboyknowsclass/claude-skills
/plugin install model-files@claude-skills
```

Install it at the user scope and it also loads in local sessions the Claude desktop app starts (Code tab), where the panel is drawn beside the chat. It does nothing useful in cloud sessions, which cannot see your disk.

Open the panel any time with `/model-files`.

## Settings

Set these in `/config` (or under `pluginConfigs.model-files` in `~/.claude/settings.json`):

| Setting | Default | Example |
| --- | --- | --- |
| `folder` | `~/3D Models` | `D:\3D Models` |
| `extensions` | `3mf,stl,step,stp,obj,f3d,fcstd,scad,gcode,nc,dxf,svg` | `3mf,stl` |
| `count` | `15` | `30` |

## Default apps

The **Open** button uses the OS default app. If a type has none (common for `.3mf` on Windows), set one once:

- **Windows**: right-click a file of that type > Open with > Choose another app > pick your slicer > tick *Always use this app*.
- **macOS**: select a file > Get Info > Open with > pick the app > *Change All...*

## How it works

`hooks/register.tsx` lists the folder with `$.fs.list` (up to 8 levels, 3000 folders), and opens files with `powershell Invoke-Item` / `explorer /select` on Windows (the path is passed in an environment variable, so spaces and quotes are safe) or `open` / `open -R` on macOS. Tests: `claude plugin test plugins/model-files`.
