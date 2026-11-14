---
name: gridfinity
description: Use when designing Gridfinity storage (bins, item-holder bins with form-fit pockets, baseplates with or without magnets) in SolidCraft through its MCP server, or when a user asks for a gridfinity bin or baseplate in SolidCraft.
---

# Gridfinity bins and baseplates in SolidCraft

Build spec-correct Gridfinity parts in SolidCraft over MCP, as editable sketches and extrudes, checked with `measure` against numbers you work out first. Every recipe below was run on SolidCraft 0.42 and its measured volume matched the computed one to 0.001 %.

This skill is generic. Anything personal (colours, label font, house heights, where files go, naming) comes from the user's preferences: see "Preferences" below.

## Before the first call

1. Read SolidCraft's own modeling guide once: `skill_reference {"skill":"solidcraft-modeling"}`. This skill only adds Gridfinity on top of it.
2. Load the user's preferences (below). Ask only for what the request and the preferences leave open: usually the grid size, height and what goes in the bin.
3. `inspect_design {"measure":false,"sketches":false}`. If the open design has work in it, ask before `new_design`.
4. Write the plan: cells, height, every feature with its world coordinates, and the expected volume after each stage.

## Preferences

Look for the user's Gridfinity preferences, first match wins:
1. What the user says in this request.
2. A `gridfinity-preferences.md` file in the project or working folder, or `~/.claude/gridfinity-preferences.md`, when you can read files.
3. A "Gridfinity preferences" section in the project instructions, CLAUDE.md or memory, or a personal skill named like `my-gridfinity-preferences`.
4. The defaults in the table below.

| Key | Default | Meaning |
|---|---|---|
| `height_u` | 3 | Bin height in 7 mm units, without stacking lip |
| `style` | `pocketed` | `pocketed`: solid block with item-shaped pockets cut in. `hollow`: standard open bin with walls |
| `stacking_lip` | no (pocketed), yes (hollow) | Spec stacking lip on the rim |
| `magnets` | yes | 6x2 mm magnet holes, D6.5 x 2.4, 4 per cell |
| `pocket_embed` | 0.5 | Fraction of the item's height that sits in its pocket |
| `pocket_clearance` | 0.5 | Gap per side around an item, mm |
| `min_floor` | 2 | Least material under a pocket, above the foot top (z4.75), mm |
| `finger_access` | quarter-sphere D20 | Scoop at the item's grip points (see recipe) |
| `label` | none | `debossed` text on the top face, or none |
| `label_font` | SolidCraft's built-in | An installed font family; the built-in font has no bold |
| `label_height` | 10 | Capital height, mm (7 mm is marginal for a 0.4 mm nozzle) |
| `label_depth` | 1 | Deboss depth, mm |
| `body_colour` | none | `#rrggbb` for the whole body |
| `top_colour` | none | `#rrggbb` for the top face; may depend on a category |
| `baseplate_magnets` | yes | Magnet floor under the baseplate sockets |
| `save_folder` | ask | Folder for `.sc`, `.3mf`, `.stl` (must already exist) |
| `file_name` | `<Name> - <h>u` | Name pattern for saved and exported files |
| `exports` | 3mf, stl | Formats to export |

A preferences file is plain Markdown with these keys, for example:

```markdown
# Gridfinity preferences
- height_u: 3
- label: debossed, font "OCR A Extended", 10 mm, 1 mm deep
- body_colour: #9B9EA0
- top_colour by category: tools #A3D8E1, consumables #E8AFCF
- save_folder: D:\3D Models\Gridfinity\<category>\<Name>\
```

## Gridfinity dimensions (mm)

Gridfinity is by Zack Freedman (MIT). gridfinity.xyz/specification is an early draft (magnets 6x2, M3 screws), so these are the original dimensions as gridfinity-rebuilt-openscad implements them.

- Grid 42. Height unit 7. A bin of `n x m` cells is `(42n - 0.5) x (42m - 0.5)` with r3.75 corners.
- **Coordinates used here:** bin centred on the origin in X and Y, z0 = bottom of the feet. A bin of `h` units has its top at `z = 7h` (3u: z21). Cell centres are at `42 (i - (n-1)/2)`.
- **Foot** (one per cell, from z0 up): 35.6 sq r0.8 at z0, 45 deg out over 0.8 to 37.2 sq r1.6, straight 1.8 to z2.6, 45 deg out over 2.15 to 41.5 sq r3.75 at z4.75. Foot volume 6864.5736 mm3.
- **Block** above the feet: z4.75 to 7h. A hollow bin's cavity floor is at z7.
- **Magnet holes:** D6.5 x 2.4 up from z0, at each cell centre +/-13 in X and Y. Screw holes (optional): D3, 6 deep, same centres.
- **Stacking lip:** from its inner tip, 0.7 at 45 deg, 1.8 up, 1.9 at 45 deg (4.4 tall, 2.6 deep), outer face flush with the wall.
- **Baseplate socket** (from the top down): 42 sq r4, 45 deg in over 2.15 to 37.7 sq r1.85, straight 1.8, 45 deg in over 0.7 to 36.3 sq r1.15. Profile 4.65 tall. Socket void volume 6911.1318 mm3. Plate outer size `42n x 42m`, r4.
- Volume of a rounded rectangle prism: `(a*b - (4 - pi) r^2) * height`. For a 45 deg taper, integrate: each side and the radius grow by the height climbed.

## Recipe 1: pocketed bin (solid block, item pockets)

Example: 1x4 cells, 3u, one 30 x 138 pocket. Bin 41.5 x 167.5, cells at y = -63, -21, 21, 63. Send as 3 to 4 batches with `"verbose": false`, a `measure {"summary":true}` after each.

**Batch A: feet and block.** Build one foot as its own body, pattern the body, then join.

```json
{"commands":[
 {"command":"sketch.create","params":{"plane":"XY","name":"Foot sketch"}},
 {"command":"sketch.rectangle.rounded","params":{"p0":[-17.8,-80.8],"p1":[17.8,-45.2],"radius":0.8}},
 {"command":"sketch.finish","params":{}},
 {"command":"solid.extrude","params":{"sketch":"Foot sketch","distance":0.8,"taper":"45 deg","operation":"new","body_name":"Foot","name":"Foot chamfer low"}},
 {"command":"solid.extrude","params":{"face":[0,-63,0.8],"distance":1.8,"operation":"join","name":"Foot straight"}},
 {"command":"solid.extrude","params":{"face":[0,-63,2.6],"distance":2.15,"taper":"45 deg","operation":"join","name":"Foot chamfer high"}},
 {"command":"solid.pattern.rectangular","params":{"bodies":["Foot"],"dir1":[0,1,0],"count1":4,"spacing1":42,"name":"Feet"}},
 {"command":"sketch.create","params":{"plane":"XY","offset":4.75,"name":"Block sketch"}},
 {"command":"sketch.rectangle.rounded","params":{"p0":[-20.75,-83.75],"p1":[20.75,83.75],"radius":3.75}},
 {"command":"sketch.finish","params":{}},
 {"command":"solid.extrude","params":{"sketch":"Block sketch","distance":16.25,"operation":"new","body_name":"Bin","name":"Block"}},
 {"command":"solid.combine","params":{"target":"Bin","tools":["Foot","Foot (2)","Foot (3)","Foot (4)"],"operation":"join","name":"Join feet"}}
]}
```

- Expect 1 body `Bin`, bbox z0..21, volume `block + cells * 6864.5736` (here 140219.95).
- For a 2D grid add `dir2`, `count2`, `spacing2`. Copies are named `Foot (2)`, `Foot (3)`, ...: read them from `created_bodies`.
- Block height is `7h - 4.75`.

**Batch B: magnets and pockets.**

```json
{"commands":[
 {"command":"sketch.create","params":{"plane":"XY","name":"Magnet sketch"}},
 {"command":"sketch.circle.center","params":{"center":[-13,-76],"diameter":6.5}},
 "... one circle per hole: each cell centre +/-13 in X and Y ...",
 {"command":"sketch.finish","params":{}},
 {"command":"solid.extrude","params":{"sketch":"Magnet sketch","distance":2.4,"operation":"cut","name":"Magnet holes"}},
 {"command":"sketch.create","params":{"plane":"XY","offset":21,"name":"Pocket sketch"}},
 {"command":"sketch.rectangle.rounded","params":{"p0":[-15,-81.25],"p1":[15,56.75],"radius":3}},
 {"command":"sketch.finish","params":{}},
 {"command":"solid.extrude","params":{"sketch":"Pocket sketch","distance":14.25,"direction":"negative","operation":"cut","name":"Pocket"}}
]}
```

- Pocket outline = the item's outline plus `pocket_clearance` per side. Trace irregular items as lines and arcs (`sketch.line`, `sketch.arc.three_point`) from measurements or a photo with a scale.
- Pocket depth = `pocket_embed` x item height, capped so the floor stays at or above `4.75 + min_floor`. Here 29 mm stick x 0.5 = 14.5, capped to 14.25 (floor z6.75).
- Leave room on the top face for a label if one is wanted.
- Check: volume drops by `holes * 79.6282 + pocket area * depth`; `body_topology {"body":"Bin","faces":"cylinders"}` lists every magnet hole (r3.25, extent 0..2.4) and pocket corner.

**Batch C: finger scoop (quarter sphere).** Its own batch: booleans with curved faces are the riskiest step.

```json
{"commands":[
 {"command":"solid.sphere","params":{"center":[0,52.25,21],"radius":10,"operation":"new","body_name":"Scoop","name":"Scoop sphere"}},
 {"command":"solid.box","params":{"length":30,"width":20,"height":30,"center":[0,42.25,21],"operation":"cut","targets":["Scoop"],"name":"Scoop half"}},
 {"command":"solid.combine","params":{"target":"Bin","tools":["Scoop"],"operation":"cut","name":"Scoop cut"}}
]}
```

- The sphere is centred on the top face, a few mm (here 4.5) inside the pocket edge so its flat wall sits under the item and a finger gets beneath it. The box removes the half towards the item; the half above the top face is outside the bin anyway.
- Put scoops where the item is gripped: the ends of a stick, either side of a tool's handle.

**Batch D: label and colours.**

```json
{"commands":[
 {"command":"sketch.create","params":{"plane":"XY","offset":21,"name":"Label sketch"}},
 {"command":"sketch.text","params":{"text":"GLUE","at":[0,66.25],"height":10,"font":"<label_font>","align":"center","vertical_align":"middle"}},
 {"command":"sketch.finish","params":{}},
 {"command":"solid.extrude","params":{"sketch":"Label sketch","distance":1,"direction":"negative","operation":"cut","name":"Label"}},
 {"command":"appearance.assign","params":{"bodies":["Bin"],"color":"<body_colour>"}},
 {"command":"appearance.assign","params":{"faces":[[18,80,21]],"body":"Bin","color":"<top_colour>"}}
]}
```

- Leave out `font` for the built-in font. An installed font is named by family; a .ttf path also works.
- Text runs along X. For a long narrow bin, `angle: 90` turns it along Y. Check that the text fits: about 0.7 x height per capital.
- The top-face colour pick is any point on the top face (z = 7h) clear of pockets and letters. The deboss floors keep the body colour, so letters read in the body colour.
- 3MF export writes the body colour and per-face colours as 3MF base materials. Slicers may need the colours mapped to filaments by hand.

**Finish.** `export {"path":"<folder>/<Name> - 3u.3mf","bodies":["Bin"]}`, the same for `.stl`, and `save {"path":"<folder>/<Name> - 3u.sc"}`. Then one `screenshot {"source":"model","view":"iso","width":800,"height":500}` and show it.

## Recipe 2: hollow bin (walls, dividers, lip)

When the user has the solidcraft-gridfinity plugin (github.com/haashimrehan/solidcraft-gridfinity, MIT) installed, use it for standard hollow bins:

1. `execute {"command":"plugin.inspect","params":{"path":"<plugin folder>"}}` gives the `approval` hash.
2. `execute {"command":"plugin.run","params":{"path":"<plugin folder>","approval":"<hash>","entry":"make-bin","params":{"width":2,"depth":1,"height":3,"wall":1.2,"stacking_lip":true,"magnet_holes":true,"compartments_x":2,"compartments_y":1,"scoop":false,"label_tab":true}}}`. Every key is required; width and depth 1-6, at most 25 cells.
3. It builds no label text: add it with Batch D on the label tab or a wall.

Without the plugin, build Batch A, then cut the cavity: a rounded rectangle offset in by the wall thickness (wall 1.2 on 1x1: 39.1 sq r2.55), sketched at the top and cut down to z7. No stacking lip this way.

## Recipe 3: baseplate

Example: 3x2 with magnets, floor 3 (2.4 hole + 0.6 skin). Plate 126 x 84, cells at x = -42, 0, 42 and y = -21, 21. Build one socket void as a body, pattern it, cut it out.

```json
{"commands":[
 {"command":"sketch.create","params":{"plane":"XY","name":"Plate sketch"}},
 {"command":"sketch.rectangle.rounded","params":{"p0":[-63,-42],"p1":[63,42],"radius":4}},
 {"command":"sketch.finish","params":{}},
 {"command":"solid.extrude","params":{"sketch":"Plate sketch","distance":7.65,"operation":"new","body_name":"Baseplate","name":"Plate"}},
 {"command":"sketch.create","params":{"plane":"XY","offset":3,"name":"Socket sketch"}},
 {"command":"sketch.rectangle.rounded","params":{"p0":[-60.15,-39.15],"p1":[-23.85,-2.85],"radius":1.15}},
 {"command":"sketch.finish","params":{}},
 {"command":"solid.extrude","params":{"sketch":"Socket sketch","distance":0.7,"taper":"45 deg","operation":"new","body_name":"Socket","name":"Socket chamfer low"}},
 {"command":"solid.extrude","params":{"face":[-42,-21,3.7],"distance":1.8,"operation":"join","name":"Socket straight"}},
 {"command":"solid.extrude","params":{"face":[-42,-21,5.5],"distance":2.15,"taper":"45 deg","operation":"join","name":"Socket chamfer high"}},
 {"command":"solid.pattern.rectangular","params":{"bodies":["Socket"],"dir1":[1,0,0],"count1":3,"spacing1":42,"dir2":[0,1,0],"count2":2,"spacing2":42,"name":"Sockets"}},
 {"command":"solid.combine","params":{"target":"Baseplate","tools":["Socket","Socket (2)","Socket (3)","Socket (4)","Socket (5)","Socket (6)"],"operation":"cut","name":"Cut sockets"}}
]}
```

- Expect `plate - cells * 6911.1318` (here 39395.74).
- Magnets: a sketch on `{"plane":"XY","offset":3}` with a D6.5 circle at each cell centre +/-13, extruded `distance 2.4, direction negative, operation cut`. Expect -79.6282 per hole (here 37484.40).
- Open-frame (no magnets): plate 4.65 tall, socket sketch at z0, socket faces at z0.7 and z2.5. Expect 7684.94 for 3x2.
- Bigger than the print bed: split into tiles of whole cells (a 256 mm bed fits 6 x 6). Each tile is its own baseplate.

## Verify

- Every stage: `measure {"summary":true}` against your number. A cut that leaves the volume unchanged missed.
- Positions: `body_topology {"body":"Bin","faces":"cylinders"}` for holes and pocket corners; a top-view screenshot for the layout.
- An item stand-in (a box or cylinder the item's size, `operation: new`) placed in the pocket is a quick fit check; export with `bodies: ["Bin"]` so it stays out of the files.

## Traps

| Symptom | Fix |
|---|---|
| Save or export refused: folder missing | SolidCraft never creates folders. Ask the user to create it. |
| Save refused: outside the folders this agent may use | The user adds `--allow-path <folder>` to the solidcraft MCP server's args and restarts the client. |
| Bold label does nothing | The built-in font has no bold: name an installed font. |
| Fillets between curved faces fail | Do them before the scoop, or leave them out. |
| Long batch rolled back at the last step | Put risky steps (scoop, fillets) in a batch of their own. |
