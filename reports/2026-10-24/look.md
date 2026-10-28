# What is left to make GHT LOOK finished (reporter-look, 2026-10-24)

**Verdict: the toys are close to a collectible, but the stage they stand on is not. The ground is an unlit flat picture, the river is 147 tiles from your base so you never see it, buildings are plain blocks with no shadow, and the edge shine is under one pixel at gameplay zoom. Fixing the ground, the river and the shadows will change the picture more than any more toaster polish.**

Marks: VERIFIED = I ran it or cite file:line. UNVERIFIED = reasoned from code, not seen in a browser. I did not open a browser; Claude's 11:10 browser observations are taken as fact.

Chat note: `node say.mjs reporter-look "..."` is rejected (only fable, sonnet, haiku, claude and gpt are allowed names), so I posted nothing to the chat. VERIFIED (say.mjs:4). The summary is in my final reply instead.

## Direct answers

**Why is the ground a flat teal plane?** `wheatfield-terrain.mjs` IS mounted (play/app.mjs:337-342, `createWheatfieldTerrain`). It draws one `PlaneGeometry` with a 1024x1024 picture of the tile colours on a `MeshBasicMaterial`, which is unlit (play/wheatfield-terrain.mjs:114-116). It adds three small instanced sets: boulders, wheat blades, pad slabs (:121-185). `heightAt` returns 0 (:197). The 14,928 "high" tiles are only a lighter colour (:40, :48), not raised. Ground colour is Base ground #52696B, the style bible's teal-grey (STYLE-BIBLE.md section 8). VERIFIED. Because the material is unlit, nothing casts a shadow onto it: the sun shadow and `receiveShadow` do nothing, and only the unit decals darken the ground. VERIFIED (`createContactShadows` is called only at play/toaster-units.mjs:115).

**Where is the river?** The creek is in the map: 2,424 water tiles on seed 1, drawn in navy and a lighter band (wheatfield-terrain.mjs:30, :18-19). The Power Strips are at (18,232) and (237,23). The nearest creek tile to each is 146.6 tiles away. VERIFIED (I generated the map in node). At the opening view of 16 tiles tall (camera.mjs:8) you cannot see it. The one blue tile is the home spring ('U', 2 on the map at (241,29) and (14,226)). VERIFIED. Haiku already posted "no creek within 106 tiles" (chat #820). That is a map-layout choice, not a render bug.

**No relief?** Correct. Cliffs ('#', 1,332 tiles) are 5-sided cylinder boulders 0.7 to about 1.9 tiles tall (:131-140). There are no ramps, no cliff walls, no raised plateaus. The Design Studio's `grid-terrain-kit.mjs` has an extruded cliff, a wedge ramp and a river (lines 27-43). VERIFIED.

**Camera vs spec.** The spec says perspective, FOV 35, about 40 degrees (RENDERING.md part 9). The game uses an orthographic camera, `ortho: true, orthoHeight: 24` (play/app.mjs:313), pitch 42 degrees (play/camera.mjs:6), zoom 12 to 40 tiles tall, open at 16 (camera.mjs:6-8). Pixel ratio is capped at 1.5 by the toy look (toy-render.mjs, `dprCap = 1.5`) and the governor steps 1.5, 1.25, 1.0. 4x MSAA is set on the composer targets. VERIFIED by code. Whether any of it looks right on the Air: UNVERIFIED.

**Why the edges and satin cannot be told apart at 800x600.** The edge band is 0.025 model units (play/toy-render.mjs, `applyToyEdges` default). A model unit is 0.9 tiles (toaster-units.mjs:25). At 800x600 with 16 tiles visible that is about 37 px per tile, so the band is about 0.8 px wide. At 1080p it is about 1.5 px. Computed, VERIFIED arithmetic; the look is UNVERIFIED. The band is in model size, not screen pixels, so it vanishes when zoomed out.

## RENDERING.md parts: where each one lives

| # | Part | Play page | Studio | Evidence |
|---|---|---|---|---|
| 1 | Lights, AgX, sRGB | YES (but the engine's ACES, bloom and vignette are still in the chain) | yes (uses ACES) | toy-render.mjs applyToyLook; engine.mjs:207, :262-273 |
| 2 | Soft shadow, contact decals | PARTIAL: key shadow on, decals on units only; none under buildings, none onto the ground | n/a | toaster-units.mjs:115; ground is Basic |
| 3 | Satin materials | units YES; buildings NO (plain `MeshStandardMaterial`, roughness 0.78, spec 0.48) | yes | toaster-buildings.mjs:30 |
| 3b | Environment map (PMREM) | NOWHERE in the game | Studio only (style-lab/app.mjs:8, :16, env intensity 0.35) | grep |
| 4 | Edge highlight | units YES (sub-pixel); buildings, terrain NO | yes | toy-render.mjs; toaster-units.mjs:60 |
| 5 | Colour management | YES | yes | toy-render.mjs |
| 6 | Ambient occlusion | NOWHERE (no baked cavities, no SSAO) | NOWHERE | grep SSAO |
| 7 | Outline / silhouette pass | NOWHERE in play. Studio has an inverted-hull ink in lab.mjs:48-57, off in the new toy look | Studio only | lab.mjs |
| 8 | Eyes | YES (unlit, cyan/orange) | yes | toaster-units.mjs:56-58 |
| 9 | Camera FOV 35 | NO: orthographic | n/a | app.mjs:313 |
| 10 | Bloom | ON in play at quality high (strength 0.55 to 0.65, threshold 0.82 to 0.85), but RENDERING.md says "ship without it first"; UNVERIFIED whether cream glows | Studio: only in the glossy look | engine.mjs:49, :262-266; palette.mjs:94 |
| 11 | AA | MSAA 4x YES | | toy-render.mjs |
| 12 | Ground | flat quiet palette, unlit | | wheatfield-terrain.mjs |
| 13 | Instancing | units YES; buildings NO (one mesh group per building); terrain props YES | | |
| 14 | Quality governor | YES, logs median/p95 but nothing records them anywhere | | toy-render.mjs createGovernor |
| - | LOD | NOWHERE | | grep |
| - | Fog (depth) | `scene.fog = null` in the wheatfield terrain, so no distance fog | | wheatfield-terrain.mjs:101 |
| - | Fog of war | I found no code path in play/app.mjs that draws it (no "fog", "vision" or `setVisibility`). `render.mjs` has `setFog` but app.mjs does not use `render.mjs`. UNVERIFIED in a browser | | grep app.mjs |

Note: play/app.mjs builds the engine directly with `createEngine`. `play/render.mjs` (createPlayRenderer) is used only by play/perf.html and tests. VERIFIED.

## RANKED: what is left

| Rank | What a player sees now | What it should be | Where in code | Evidence | Size | Owner | Status |
|---|---|---|---|---|---|---|---|
| 1 | Ground is a flat teal picture with a square grid; no cliffs, ramps, plateaus | A lit stage with real relief: extruded cliff walls on '#' and plateau edges, wide wedge ramps, high ground raised, ground that takes sun and shadows | play/wheatfield-terrain.mjs:114-116, :197; Studio kit style-lab/grid-terrain-kit.mjs:27-43 | STYLE-BIBLE section 8 and 8a ask for "crisp elevation", "dark cliffs, wide ramps" | L | fable (design) then sonnet | VERIFIED |
| 2 | No river visible; one blue spring tile | Water you meet in the first minute and that reads as water (navy ribbon, pale shallow band, a mill dam). Either bring the creek closer to the bases or put a visible pond near each base | maps/layout-wheatfield.mjs (creekCentre, BEND, line 31-33); wheatfield-terrain.mjs:17-19, :30 | nearest creek tile 146.6 from both Strips; haiku #820 | M (map) + S (water look) | fable decides, sonnet builds | VERIFIED |
| 3 | Buildings and rocks float with no shadow on the ground; only toasters have soft blobs | Soft contact decal under every building and boulder, and the key shadow landing on the ground | toy-render.mjs createContactShadows (units only); wheatfield-terrain.mjs:115 (Basic material) | `createContactShadows` has one caller | S | sonnet | VERIFIED |
| 4 | Satin and edge shine cannot be seen at 800x600 | Edge band sized in screen pixels (about 1.5 to 2 px, clamped), so it shows at every zoom; same on buildings | toy-render.mjs applyToyEdges (band 0.025 in model units) | arithmetic above | S | sonnet / gpt (edge spec) | VERIFIED math, look UNVERIFIED |
| 5 | Power Strip is a small cream block (1.3 x 0.34 x 0.6 tiles) plus the old GHT dashed glow ring; Mill, Well, Toaster are plain-matte blocks | A strip that is clearly the base: bigger, satin, edge-lit, shadow, team plug. No sci-fi ring | play/toaster-buildings.mjs:41-50; viewer3d/buildings.mjs:284-293 (ring) | roughness 0.78 vs 0.48; no applyToyEdges | M | sonnet, gpt for the Strip design | VERIFIED code; ring on the Strip UNVERIFIED |
| 6 | Wheat field is a flat gold slab with short rectangles | Contiguous golden plots with five-blade bundles, brighter than ground, shrinking with harvest | wheatfield-terrain.mjs:20-21, :151-176 (boxes 0.15 x 0.6 x 0.15, 8 per tile, Lambert) | STYLE-BIBLE: "five-blade wheat tufts" | S | haiku or sonnet | VERIFIED |
| 7 | Windmill and Dam do not exist as models; a windmill pad is a flat 0.08 slab | Windmill on its pad, a dam across the creek | wheatfield-terrain.mjs:178-185; Studio style-lab/windmill-dam.mjs; chat #827 "3D windmill/dam models NOT done" | | M | gpt (model) + sonnet (wire) | VERIFIED |
| 8 | Assembly Line and Heat Lamp fall back to GHT sci-fi builders (octagon plinth, crystals) | Toy-family blocks like the other four buildings | toaster-buildings.mjs:3-4, :9; viewer3d/buildings.mjs:15 | comment says they fall back | M | gpt (design), sonnet | VERIFIED (look UNVERIFIED) |
| 9 | Camera is orthographic | Decide: keep ortho (clean grid, easy picking) or move to perspective FOV 35 for depth and parallax. Spec says 35 | play/app.mjs:313, :384-391; camera.mjs | RENDERING.md part 9 | S code, big feel change | Joshua decides | VERIFIED |
| 10 | Bloom and vignette run in play at the "high" tier | Bloom off or tiny (0.22/0.18/1.2) catching only eyes and cords; check the cream does not glow; check ACES vs AgX is not double-applied | viewer3d/engine.mjs:207, :262-273; palette.mjs:94 | RENDERING.md part 10 | S | sonnet (A/B in browser) | code VERIFIED, look UNVERIFIED |
| 11 | No environment reflections; the toy looks matte-flat | Low-contrast studio env (PMREM) as in the Studio, tuned for the cream chassis | style-lab/app.mjs:8, :16 | not in play/ | S | sonnet | VERIFIED |
| 12 | Selection rings are green flat circles (28 sides) | Team-coloured five-sided rings, thicker, with a soft glow; hover ring | units-instanced.mjs:234-237, :388-394 | ART-DIRECTION: "selection circles are pentagons" | S | haiku | VERIFIED |
| 13 | No distance fog, no fog-of-war drawn on the page | Broad five-segment fog polygons at the map edge; unexplored near-solid slate; explored darkened | wheatfield-terrain.mjs:101 (`scene.fog = null`); play/fog.mjs (pure data only); render.mjs setFog unused by app | grep of app.mjs found nothing | M | sonnet | UNVERIFIED (a browser could show fog I did not find) |
| 14 | No silhouette / outline pass, no AO | A thin charcoal silhouette (0.75 to 1.25 px) and baked cavity darkening on the faceplate recess. Do after 1 to 5 | not present | RENDERING.md parts 6, 7 | M | gpt / sonnet | VERIFIED absent |
| 15 | Rocks are 5-sided boulders, Lambert, colour variation only | Pale slate movable rubble clearly brighter than dark cliffs, with edge light | wheatfield-terrain.mjs:121-148 | STYLE-BIBLE: movable rocks "unmistakable" | S | haiku | VERIFIED code |
| 16 | No measured frame rate for the Toaster scene | One recorded number: 200 animated toasters, full Wheatfield, on the MacBook Air, median and p95 ms | play/perf.html + play/perf-scenario.mjs (see below) | PLAYABLE.md item 31 still open | M | haiku runs it, Joshua's Air | VERIFIED gap |

## The perf benchmark (200 units, full terrain, 60 fps on the Air)

- `play/perf.html` boots `createPlayRenderer` on the GHT v4 map (128 x 128) with `grunt` and `lancer` units (play/perf-scenario.mjs:2-4, :14, :17-18; play/perf.html:25, :43-47). It does NOT use the Wheatfield map (256 x 256), the wheatfield terrain, toasters, cords, bread-life or power stations. VERIFIED.
- It does not mount via `app.mjs`, so it also misses the HUD, minimap and sound. VERIFIED.
- So it cannot answer the acceptance question as written. It needs a Wheatfield variant: 200 toasters (Crumb, Popper, Four-Slice mix) with cords, half marching, all four building kinds, power stations, bread-life, on the real `app.mjs` renderer, at `?quality=high` and balanced.
- No fps or ms number appears in the repo docs or the chat that I could find. PERF.md says rendering "is not gated here" (PERF.md last section). PLAYABLE.md item 31 is open. The governor can log median/p95 but nothing stores it. VERIFIED by grep (I may have missed a number phrased unusually).
- Draw calls: toasters are batches per part (toaster-units.mjs header). Buildings are not instanced: each Mill/Well/Toaster is a Group of separate meshes with its own materials (toaster-buildings.mjs:28-30). With many buildings that is the likely draw-call cost. UNVERIFIED.

## In the Studio but not in the game

VERIFIED: the only Studio files the play page imports are `style-lab/bread-chain.mjs` (bread-life.mjs:16) and the palette in `style-lab/terrain-kit.mjs` (wheatfield-terrain.mjs:14). `power-stations.mjs` is a design reference only (comment, power-stations-3d.mjs:2). Everything below is Studio-side; I did not check each against the play page's own copies, so "not wired" is UNVERIFIED for the individual items.

- **Real terrain shapes:** extruded cliffs, wedge ramp, river ribbon, mill-dam gap (grid-terrain-kit.mjs, terrain-kit.mjs).
- **Windmill and Dam pair** (windmill-dam.mjs).
- **Environment light and bloom:** Room environment at 0.35 and the glossy "Y2K GLOSS" look (style-lab/app.mjs:8-25).
- **Ink outlines** (lab.mjs:48-57), the old inverted-hull outline.
- **Mood and reaction art:** thought-moods.mjs, smoke-alarm.mjs, cold-toast.mjs, toppings.mjs, hit-defeat.mjs.
- **Attack studies:** pop-shot.mjs, hot-coil.mjs, quad-volley.mjs, special-attacks.mjs, defroster.mjs, flying-toast.mjs, cute-attack-rig.mjs (the play page has its own Coil-based poses in coil-motion.mjs).
- **Buildings and props:** breadbox.mjs, toaster-oven.mjs, outlet.mjs, turret.mjs, grudge-kettle.mjs, timer.mjs, squad.mjs, toast-stacks.mjs. Retired in the Studio picker: Trading House, Press, Track, Drill, Churn, Generator, ground patches (chat #814, #826).
- **HUD icon set** (hud-icons.mjs) and a sound list (sound-list.mjs).

## Open questions for Joshua

1. **River:** should the creek run through the middle of each base's half, or should each base get a pond close by? Today the nearest creek is 147 tiles from the Strip, so water never shows up in play.
2. **Camera:** keep the orthographic "classic RTS" camera, or switch to a perspective camera at FOV 35 as the spec says? It changes the whole feel and every pick calculation.
3. **Relief:** do you want real cliffs and ramps on Wheatfield (a big change, a few days of work), or is a flat battlefield with better shadows enough for v0.1?
4. **Bloom:** do you want any glow at all, or only on eyes and cords?
5. **Shapes:** the Mill and Well use 4-sided and 5-sided prisms (toaster-buildings.mjs:56-58, :70) while the bible says "five facets, always". Should buildings follow it strictly, or are plain boxes fine?
