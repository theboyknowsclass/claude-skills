---
name: cad-setup
description: Use when setting up, installing, repairing or updating the tools for AI-driven CAD over MCP on a machine (SolidCraft headless and live MCP, the SolidCraft Gridfinity plugin, FreeCAD with freecad-mcp, weekly SolidCraft auto-update, optional Rust/gh contributor tools), on Windows or macOS, with Linux notes.
---

# Set up a machine for CAD over MCP

Installs and wires up the CAD tools that Claude drives over MCP, then proves each one works. Every step is idempotent: check first, install only what is missing, and re-run the whole skill safely to repair or update.

This skill is generic. Folders, which tools to install and update times come from the user's preferences: see "Preferences".

## Rules

1. **Ask before every install or download over ~50 MB**, saying what, how big and where it goes. One "yes" covers that one component, not the rest.
2. **Never type, read, store or ask for a password, token or 2FA code.** Sign-ins (`gh auth login`, Autodesk, admin/UAC/sudo prompts, macOS Gatekeeper) are the user's to do; tell them exactly what to click, then wait.
3. **Back up any config before editing it** (`<file>.bak-<yyyymmdd-hhmm>`), merge into it (never overwrite other servers or keys), and show the user the diff.
4. **Pin and verify.** Download only from the official sources below, check the published SHA-256 when there is one, and pin MCP package versions.
5. Prefer per-user installs (no admin). Use a system package manager only if the user prefers it.
6. After each component, run its check (see "Verify") and report pass or fail with the evidence. Do not move on silently after a failure.
7. Changes to MCP config take effect only after the client restarts. Say so, and finish with one combined restart.

## Preferences

First match wins:
1. What the user says in this request.
2. A `cad-setup-preferences.md` file in the project or working folder, or `~/.claude/cad-setup-preferences.md`.
3. A "CAD setup preferences" section in project instructions, CLAUDE.md or memory, or a personal skill named like `my-cad-setup-preferences`.
4. The defaults below.

| Key | Default | Meaning |
|---|---|---|
| `models_folder` | ask (suggest `~/3D Models`) | Root for saves and exports. Becomes the MCP `--allow-path`. Created if missing |
| `components` | `solidcraft, solidcraft_live, freecad` | Any of: `solidcraft`, `solidcraft_live`, `gridfinity_plugin`, `freecad`, `freecad_gui_addon`, `dev_tools`, `gh` |
| `mcp_clients` | every one installed | `claude-desktop`, `claude-code` |
| `solidcraft_dir` | Win `%LOCALAPPDATA%\Programs\SolidCraft`; mac/Linux `~/.local/share/solidcraft` | CLI (and on Windows the app) install folder |
| `solidcraft_app` | yes on a desktop, no on a headless machine | Install the GUI app (needed only for live mode) |
| `auto_update` | weekly, Sunday 10:00 | SolidCraft update schedule, or `off` |
| `freecad_mcp_version` | latest on PyPI, then pinned | `freecad-mcp` package version for `uvx` |
| `freecad_rpc_autostart` | yes | Start the addon's RPC server whenever FreeCAD opens |
| `plugins_dir` | SolidCraft's per-user plugins folder: Win `%LOCALAPPDATA%\SolidCraft\plugins`, mac `~/Library/Application Support/SolidCraft/plugins`, Linux `${XDG_DATA_HOME:-~/.local/share}/solidcraft/plugins` | Where plugin packages go (the app's Preferences > Plugins lists this folder) |

## Before the first step

1. Detect the OS, architecture, whether there is a desktop session (headless Mac or Linux server: no GUI app, no live mode), and which shells and package managers exist (`winget`, `pwsh`, `brew`, `apt`/`dnf`/`pacman`, `flatpak`).
2. Inventory what is already there: run every check in "Verify" and read each MCP client config. Do not reinstall what passes.
3. Load preferences. Ask only for what is still open (usually `models_folder` and `components`).
4. Show a plan: a table of component, status (ok / missing / outdated), action, download size. Get a yes, then work through it one component at a time.

## MCP client config locations

| Client | Windows | macOS | Linux |
|---|---|---|---|
| Claude desktop | `%APPDATA%\Claude\claude_desktop_config.json` (Store install: under `%LOCALAPPDATA%\Packages\*Claude*\LocalCache\Roaming\Claude\`) | `~/Library/Application Support/Claude/claude_desktop_config.json` | n/a |
| Claude Code (user scope) | `claude mcp add -s user ...` | same | same |

Claude desktop entries go under `"mcpServers"`. In JSON, Windows paths need doubled backslashes. For Claude Code, `claude mcp list` shows what is registered; `claude mcp remove -s user <name>` before re-adding a changed entry.

## 1. SolidCraft (`solidcraft`)

Source: https://github.com/tangency-labs/solidcraft/releases/latest. Releases carry `SHA256SUMS.txt`.

**Install with the bundled script** (it downloads, checks the SHA-256, installs, and is also what the auto-update runs):

- Windows (portable zip, no admin, ~160 MB):
  `powershell -NoProfile -ExecutionPolicy Bypass -File "<skill>/scripts/solidcraft-update.ps1" -InstallDir "<solidcraft_dir>" -Shortcut`
  Use the portable zip, not the MSI: the MSI can fail with error 1603 when Windows Installer is unhealthy, and the zip avoids it entirely. The script picks x64, arm64 or x86. `-Shortcut` adds a Start menu entry.
- macOS (CLI zip ~145 MB, plus the app with `--app`):
  `bash "<skill>/scripts/solidcraft-update.sh" --install-dir "<solidcraft_dir>" [--app]`
  The script removes the quarantine flag from what it installed. If macOS still blocks the app, the user approves it in System Settings > Privacy & Security.
- Linux (tarball ~165 MB): same script. Alternatives the user may prefer: the release's `.deb`, `.rpm`, AppImage, Flatpak or Snap.

Copy the script to a stable place first (Windows `%LOCALAPPDATA%\Programs\SolidCraft-Updater\`, mac/Linux `~/.local/share/solidcraft-updater/`), because the plugin cache path can change. Its log sits next to it.

**Register the MCP server** (headless; it works without the app running). Make sure `models_folder` exists first, because SolidCraft's MCP cannot create folders.

```json
"solidcraft": {
  "command": "<solidcraft_dir>/solidcraft-cli[.exe]",
  "args": ["mcp", "--allow-path", "<models_folder>"]
}
```

Claude Code: `claude mcp add -s user solidcraft -- "<cli>" mcp --allow-path "<models_folder>"`

If `gridfinity_plugin` (or any plugin) is wanted, add a second `"--allow-path", "<plugins_dir>"` pair to both SolidCraft servers: MCP keeps its file scope for plugins too, so the server cannot read a package outside its allowed paths.

`solidcraft-cli mcp setup --dry-run --client claude-desktop|claude-code [--live]` prints SolidCraft's own registration. It is a useful cross-check, but it does not add `--allow-path`, so add that yourself. Without `--allow-path` the server cannot save or export to the models folder. Note that `solidcraft-cli run` (scripts) has no path restriction; only the MCP server is sandboxed.

## 2. SolidCraft live mode (`solidcraft_live`)

Drives the running app so the user watches the model being built. Needs the GUI app, so skip it on a headless machine.

```json
"solidcraft-live": {
  "command": "<cli>",
  "args": ["mcp", "--connect", "127.0.0.1:7878", "--allow-path", "<models_folder>"]
}
```

The user must turn on **Let AI agents connect** in the app (Preferences > AI) and keep the app open. If the app shows a different port or a token, use those (`--token <T>` goes after the address; prefer passing it through the client's `env` if the client supports it, and never echo it back).

## 3. Auto-update (`auto_update`)

- **Windows** (scheduled task, runs as the user, no admin):

```powershell
$ps = (Get-Command pwsh -EA 0).Source; if (-not $ps) { $ps = (Get-Command powershell).Source }
$script = "$env:LOCALAPPDATA\Programs\SolidCraft-Updater\solidcraft-update.ps1"
$a = New-ScheduledTaskAction -Execute $ps -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
$t = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 10:00
$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable
Register-ScheduledTask -TaskName 'SolidCraft Update' -Action $a -Trigger $t -Settings $s -Force
```

- **macOS** (`~/Library/LaunchAgents/com.user.solidcraft-update.plist`, then `launchctl bootstrap gui/$(id -u) <plist>`; on a headless Mac with no GUI login use a `user/$(id -u)` domain or cron):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.user.solidcraft-update</string>
  <key>ProgramArguments</key><array>
    <string>/bin/bash</string><string>/Users/USER/.local/share/solidcraft-updater/solidcraft-update.sh</string>
  </array>
  <key>StartCalendarInterval</key><dict><key>Weekday</key><integer>0</integer><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>/Users/USER/.local/share/solidcraft-updater/update.log</string>
  <key>StandardErrorPath</key><string>/Users/USER/.local/share/solidcraft-updater/update.log</string>
</dict></plist>
```

  Add `--app` to the arguments if the app is installed. Use the real home path; launchd does not expand `~`.

- **Linux**: a systemd user timer (`OnCalendar=Sun 10:00`, `Persistent=true`) or a crontab line `0 10 * * 0 bash ~/.local/share/solidcraft-updater/solidcraft-update.sh >> ~/.local/share/solidcraft-updater/update.log 2>&1`.

Test it once by hand with `-CheckOnly` / `--check-only`. Tell the user that after an update the MCP clients need a restart to pick up the new server.

## 4. SolidCraft Gridfinity plugin (`gridfinity_plugin`)

Source: https://github.com/haashimrehan/solidcraft-gridfinity/releases/latest (`solidcraft-gridfinity-<v>.zip` plus a `.sha256` file; MIT; sandboxed WASM, no files, network or clock).

1. Download the zip and its `.sha256`, verify, and unzip so that `<plugins_dir>/solidcraft-gridfinity/plugin.json` exists. App users can instead use **Plugins > Install plugin...** and pick the zip; it lands in the same folder.
2. Make sure `<plugins_dir>` is an `--allow-path` of the SolidCraft MCP servers (section 1).
3. Run the `plugin.inspect` command (MCP `execute`, or a `solidcraft-cli run` script) with `{"path": "<plugin dir>"}`. It is inert: it reads the package without running it. Show the user the plugin's id, version, declared commands, limits and `approval` hash, and ask them to approve it.
4. Run it only with that hash: `{"command": "plugin.run", "params": {"path": "<plugin dir>", "approval": "<hash>", "entry": "make-baseplate", "params": {"width": 1, "depth": 1}}}`. The hash covers the exact package bytes, so a new plugin version needs a fresh inspect and approval.
5. Save the approved hash and folder where future sessions find them (the user's preferences file or project memory).

## 5. FreeCAD and freecad-mcp (`freecad`, `freecad_gui_addon`)

Two ways to use it, both through one MCP server:
- **GUI mode**: an addon inside FreeCAD runs an RPC server on `127.0.0.1:9875` (localhost only by default). FreeCAD must be open.
- **Headless mode**: the server's `execute_code_headless` runs scripts with `freecadcmd` in a separate process. FreeCAD need not be open. This is all a headless machine gets.

**a. FreeCAD** (~1 GB installed). Windows `winget install --id FreeCAD.FreeCAD -e`; macOS `brew install --cask freecad` (or the official dmg from https://www.freecad.org/downloads.php); Linux the distro package or `flatpak install flathub org.freecad.FreeCAD`. Find `freecadcmd`: Windows `C:\Program Files\FreeCAD <ver>\bin\freecadcmd.exe`; macOS `/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd`; Linux `freecadcmd` or `freecad.cmd` (Snap) or `flatpak run --command=freecadcmd org.freecad.FreeCAD`. Check with `freecadcmd --version`.

**b. uv** (gives `uvx`, which runs the MCP server with its own Python 3.12+). Windows `winget install --id astral-sh.uv -e`; macOS `brew install uv`; or the official installer from https://docs.astral.sh/uv/getting-started/installation/. Never install `freecad-mcp` into FreeCAD's bundled Python.

**c. MCP server.** Look up the latest version (`https://pypi.org/pypi/freecad-mcp/json`, `.info.version`) and pin it:

```json
"freecad": {
  "command": "<full path to uvx>",
  "args": ["freecad-mcp@<version>", "--freecadcmd", "<full path to freecadcmd>"]
}
```

Claude Code: `claude mcp add -s user freecad -- "<uvx>" freecad-mcp@<version> --freecadcmd "<freecadcmd>"`. Use full paths: GUI apps often do not inherit the shell's PATH. Optional: `--only-text-feedback` saves tokens by dropping screenshots.

**d. GUI addon** (skip on a headless machine). Download https://github.com/neka-nat/freecad-mcp/archive/refs/heads/main.zip (or the tag matching the pinned version), and copy `addon/FreeCADMCP` so that `<Mod>/FreeCADMCP/InitGui.py` exists, with no extra folder level. `<Mod>` is:

| Platform | Mod folder |
|---|---|
| Windows, FreeCAD 1.1 | `%APPDATA%\FreeCAD\v1-1\Mod\` |
| macOS, FreeCAD 1.1 | `~/Library/Application Support/FreeCAD/v1-1/Mod/` |
| Linux Debian / Arch 1.1 | `~/.local/share/FreeCAD/Mod/` / `~/.local/share/FreeCAD/v1-1/Mod/` |
| Linux Snap / Flatpak | `~/snap/freecad/common/Mod/` / `~/.var/app/org.freecad.FreeCAD/data/FreeCAD/v1-1/Mod/` |

Other versions: in FreeCAD's Python console, `os.path.join(FreeCAD.getUserAppDataDir(), "Mod")`, or headless: `freecadcmd -c "import FreeCAD; print(FreeCAD.getUserAppDataDir())"`.

**e. RPC auto-start.** Either the user ticks **FreeCAD MCP > Auto-Start Server** in the MCP Addon workbench, or write `freecad_mcp_settings.json` in the user app-data folder (the parent of `Mod`, e.g. `%APPDATA%\FreeCAD\v1-1\`), merging if it exists:

```json
{"remote_enabled": false, "allowed_ips": "127.0.0.1", "auto_start_rpc": true, "auth_token": ""}
```

Keep `remote_enabled` false. If the user wants remote access, follow freecad-mcp's configuration guide (auth token, narrow IP list) and let them set the token themselves.

## 6. Contributor tools (`dev_tools`, `gh`), optional

Only when the user wants to build or contribute to these projects.
- **Rust**: rustup from https://rustup.rs (Windows: `winget install --id Rustlang.Rustup -e`). Plugins also need `rustup target add wasm32-unknown-unknown` and `cargo install wasm-tools`.
- **Windows C++ linker** (~2-6 GB, admin): `winget install --id Microsoft.VisualStudio.2022.BuildTools -e --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"`. If it fails with a Windows Installer error (1603, 1618), a reboot usually clears it; ask the user to restart and re-run. Long paths: set `CARGO_TARGET_DIR` to a short path if the linker cannot open its output.
- **macOS**: `xcode-select --install` (user clicks through the dialog).
- **gh CLI**: Windows `winget install --id GitHub.cli -e`; macOS `brew install gh`. The user runs `gh auth login` themselves.

## 7. Not automatable: Autodesk Fusion

Fusion's MCP connection is Autodesk's own (installed and signed in from Autodesk's side). Do not try to install it. Just tell the user it exists, and if Fusion tools stop showing up in Claude, the fix that usually works is: check the Fusion MCP add-in is running, then restart Fusion and the Claude desktop app.

## Verify

Run these after installing, and at the start to inventory:

| Component | Check | Pass |
|---|---|---|
| SolidCraft CLI | `<cli> --version` | prints a version equal to the latest release |
| SolidCraft MCP | After the client restart, call `inspect_design {"measure":false,"sketches":false}` on `solidcraft` | returns a design |
| Allow-path | Save a tiny test design into `<models_folder>/_setup-test/` over MCP, then delete it | file appears |
| Live mode | Same `inspect_design` on `solidcraft-live` with the app open and agents allowed | returns the app's open design |
| Gridfinity plugin | `plugin.run` `make-baseplate` `{width:1, depth:1}` in a new design | one body |
| Auto-update | Run the updater with check-only; confirm the task/agent/timer is listed | logs "up to date" |
| FreeCAD headless | `freecadcmd --version`; then `execute_code_headless` with `import FreeCAD; print(FreeCAD.Version())` | prints version |
| FreeCAD GUI | With FreeCAD open: port 9875 listening (`Test-NetConnection 127.0.0.1 -Port 9875` / `nc -z 127.0.0.1 9875`), `get_rpc_status` has no `version_check` warning | connected |
| Claude Code | `claude mcp list` | each server "Connected" |

## Finish

1. Tell the user to restart the Claude desktop app (and Claude Code sessions) once.
2. Re-run the MCP checks above.
3. Report a short table: component, version, status, and anything left for the user (approvals, sign-ins, reboots).
4. Save where future sessions will find it: install paths, models folder, pinned versions, plugin approval hash, and any machine-specific workaround you needed.
