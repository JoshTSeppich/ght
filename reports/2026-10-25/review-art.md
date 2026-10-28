# Fresh art review: Toaster Wars play page (2026-10-25)

Reviewer: fresh eyes. I looked at the five screenshots in rooms/graphics/shots/latest/ first, then the law (STYLE-BIBLE.md, ART-DIRECTION.md, RENDERING.md), then the code.
Tags: VERIFIED = seen in a named screenshot and region, or file:line. UNVERIFIED = my guess.
Limit: I could not crop or zoom the PNGs (sandbox blocked it), so small-detail calls are made at native 1440x900.

## 1. First impression (pictures only)

The new look is a clear step up from the old one. The cream toasters now read as friendly little toys with dark faces and cyan eyes, where the old ones were muddy brown snake-things. But the picture is not yet a premium collectible. It looks like a tidy prototype: a plaid, tablecloth-like floor, a pile of fat cyan cords that is louder than the toasters it powers, and a Power Strip that reads as a cream bar with a few unexplained cyan rectangles. The wheat is tan-on-tan and easy to miss. Water and rocks are fine but sit at the edge of the frame under the HUD. Bright team colour belongs on the units, and here it sits on the cords instead. The 200-toaster crowd is a cream mass with almost no team colour, so it gives no read of who is who.

## 2. Style bible vs screenshot

| Element | Bible asks for | Screenshot shows | Verdict |
|---|---|---|---|
| Ground | Muted blue-grey, quiet, "lots of negative space", seams only a "quiet 1 px line" (STYLE-BIBLE §8; SEAM 0.14 at wheatfield-terrain.mjs:22) | play-wide, everywhere outside the objects (e.g. lower-middle x400-1100, y480-720): a strong light/dark plaid of ~40 px tiles. It reads as a woven mat or tablecloth, not flat ground. | MISS. The loudest "decoration" in the frame. |
| Wheat | "Brightest warm terrain feature", dense golden five-stalk bundles in a golden plot | play-zoomed, upper right (x1060-1440, y70-270): thin brown spikes on a tan plot. Low contrast, sparse, and toasters stand on it. The old look had darker blades that popped more. | WEAK. Warm but not bright. |
| Water | Navy ribbon, lighter shallow band, pale-cyan flow | play-wide, lower-left pond (x242-410, y657-735): navy block with a pale blue frame and glint dashes. Reads as water. The bottom HUD fade cuts it off. perf-high, bottom right: the river has a good stepped shore and glints. | GOOD (perf-high); cropped by HUD. |
| Rocks | Cliffs dark; movable rocks light slate with a light edge | play-wide, left (x242-390, y415-545) and top (x750-805, y85-165): dark charcoal pentagon stacks with a soft shadow. Pale beige pentagon pillars at x705-740, y160-230 (the old look had dark teal). Chunky and readable, and the shadow points the right way. | GOOD. The dark stacks sit near cliff value, and I can't tell which are pushable. |
| Power Strip | Cream satin bar on dark feet, charcoal socket rail with five raised sockets, a team stripe, a face, two team plugs, a cord loop (toaster-buildings.mjs:105-127) | play-zoomed, x605-835, y385-480: cream bar, charcoal socket row across the back, and cyan flat blocks at both ends (~x625,y425 and ~x815,y425), one at top centre (~x720,y405) and a thin cyan line along the front lip. Four flat cyan rectangles in all, and they carry no shading or shape. | WEAK. See change 3. |
| Mill / Well / Toaster | Blocky toys, cream + charcoal, a team block each, faces | No Mill, Well or Toaster is in any of the shots. play-wide x470-520, y205-240 shows a pale blue-grey panel with charcoal lines. I can't name it. | UNVERIFIED. Cannot judge from these shots. |
| Crumbs and Poppers | Cream box, charcoal face, two square cyan eyes, toast slab, 2-4 blocks (§0) | play-zoomed, x990-1280, y95-270: cream boxes with dark faces, cyan eyes, black wheels and cyan edge highlights. Clearly "same family" as the bar. Faces are visible from the camera. | GOOD. The best thing in the frame. |
| Cords | Bible §7: "Don't add cables or hinges that need complex rigs". Reach lines should be thin, continuous cyan. | play-wide, x760-980, y190-410 and play-zoomed, x770-1090, y100-390: four bundles of fat pale-cyan tubes with white clamps, running from the bar to the wheat. They are the most saturated and largest-area shapes in the scene and out-shout the toasters. Their wiggle in play-wide looks like a glitch. | MISS. Violates attention order (units > resources > borders). |
| Shadows | Short soft contact shadows, one key light (RENDERING.md) | play-zoomed, left rocks (x90-290, y400-580): a soft darker offset shadow on the ground. play-zoomed, bar right side (x830-860, y400-475): a soft shadow. Toasters ground well. | GOOD. |
| Edge light | Narrow warm-ivory crest on box edges, 2-2.5 px | play-zoomed, the toasters' top rims and the bar's top edge show a thin pale line. perf-high: every crowd body keeps a white rim and separates from its neighbours. | GOOD. Do not touch. |
| HUD over scene | Readable; scene stays visible | Top bar text is readable. "Flour 0 / Water 0" in dim teal at play-wide x110-235, y10-25 is faint on the dark gradient. The cream tutorial card (x12-340, y77-395) covers a big slice of the left map. The bottom panel fades over the pond. The command-card grid is empty and ghosts over the rocks. perf-high's stats box eats the top left. | MIXED. The HUD is solid and legible, but it takes ~35% of the screen. |
| Camera | FOV 35, about 40° above the horizon | Steep, near top-down. Roofs and the toaster faces both show, but the Power Strip's face is only a thin dark slot at the bottom edge. The perf-high crowd at 200 units is a cream pile, so units are hard to count. | OK. Ground and cord noise hurt it more than the angle. |
| Light wedge | None in the bible | play-wide and play-old-look, a pale diagonal wedge from the top centre to both upper corners, and a darker corner cut-off. Looks like a fog or vignette or light-cone artifact. | UNVERIFIED cause. It is in the old look too, so it is not new. |

## 3. The three changes that would most improve the picture

### 1. Calm the ground plaid
- Where: play-wide, lower-middle (x400-1100, y480-720) and the whole left field. The same plaid is in play-zoomed.
- Why: buildTileImage (play/wheatfield-terrain.mjs:93-128) paints a seam on every tile's top and left, plus a ±2% grain (line 102). At this camera that adds up to a bold light/dark checker. The bible wants "lots of negative space".
- Fix direction: fade the seam to a barely visible hairline (SEAM 0.14 at line 22, near the grain at line 102), or drop it to 0.05. Optionally keep seams only on wheat plots and shorelines.
- Acceptance: shrink play-wide to 720p. The open ground between the Power Strip and the lower-left rocks reads as one flat slate with no visible plaid, and the cream toasters become the brightest, highest-contrast things on screen.

### 2. Shrink and tame the cord bundles
- Where: play-zoomed, x770-1090, y100-390 (the four cord bundles, strip to wheat). Same in play-wide x760-980, y190-410.
- Why: the cords are drawn by the single shared cord mesh in play/toaster-units.mjs:131-138 (mats.cord), at line 136. They are wider and more saturated than the units, with white clamp pieces. This breaks "units and team colour first" and the bible's cable warning.
- Fix direction: one thin cord per toaster, darker or desaturated cyan (about half the current width), no white clamps, and no wiggle. Keep a small team-colour plug at the toaster end only.
- Acceptance: in play-zoomed, the four toasters' cream bodies out-contrast the cords. The total cyan area between the bar and the wheat is less than half what it is now, and the cords no longer hide the wheat field edge.

### 3. Make the Power Strip read as a strip, not four flat cyan rectangles
- Where: play-zoomed, x605-835, y385-480. The two end blocks (~x625,y425 and ~x815,y425) and the front lip are the team plugs and team-stripe from play/toaster-buildings.mjs:114-125. The top-centre block (~x720,y405) is not obvious from the code (UNVERIFIED). The nearest code is the team stripe (line 114) and the face plate (line 92). It is a flat bright cyan square with no socket detail.
- Why: the code intended five raised charcoal sockets (line 113), a face with two eyes at the front (lines 91-94, 115), and plugs with two charcoal prongs each (line 121). At the game camera only the cyan flat tops survive. The prongs, sockets and face are too small to read and are hidden by the steep angle.
- Fix direction: make the sockets taller and lighter so five bumps read on the silhouette. Move the face and eyes onto the top surface (where the camera sees them). Put team colour on one clearly shaped plug at each end and drop the extra top-centre block. Check the strip at the real zoom.
- Acceptance: in play-zoomed, you can count five sockets on the bar, find a face on the bar's top, and see exactly two cyan plugs, with no unexplained flat cyan rectangle.

Runner-up, not in the top three: give the wheat darker, taller, denser blades on a deeper-gold plot (play/wheatfield-terrain.mjs:145-170, WHEAT_TUFT) so it reads as the brightest warm terrain feature.

## 4. Already right, do not touch

- The toaster design: cream box, charcoal face, two cyan square eyes, black wheels (play-zoomed x990-1280, y95-270). Faces and slots read from above.
- The edge-light crest and per-instance edge shader (play/toy-render.mjs:36-134, 2-2.5 px band). It makes perf-high's pile legible.
- The shadow rig and soft contact decals (RENDERING.md rig; toy-render.mjs:210-300). The shadows are short, soft and consistent in every shot.
- The water treatment: navy middle, pale shore band, glint dashes (perf-high bottom right, x800-1440, y690-900).
- The five-sided dark rock stacks and their shadows (play-wide x242-390, y415-545).
- The palette discipline: cool grey-green ground, cream units, cyan as the accent. Only the cords overshoot.
- The HUD top bar and minimap (play-wide, top y10-50 and bottom-left x10-175, y732-895). They are legible and out of the way.
- The studio (studio.png): the lab is clean and works as a showcase. One Crumb at x685-795, y280-365, with a note that it is a lone unit at 23 FPS on this machine.
- Performance caution (perf-high): the HUD reports p95 291 ms against a 16.7 ms budget. That is a performance problem, not an art one, and it must not be "fixed" by cutting the edge or shadow work above.
