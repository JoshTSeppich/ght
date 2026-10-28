# SWITCHED-OFF: built, tested or shipped, but not on /play

Written 2026-10-26 by Docs and Cleanup (card 13, item 2). Checked by reading the code: no page imports these, or nothing
calls them. Nothing has been deleted. Each line needs Joshua's choice: **wire** (name the expert who does it) or **delete**.

## Panels and systems

- **Research card** (play/research-card.mjs, its test): no page imports it, and app.mjs has no research code. /play has no research
  (play/toaster-play.mjs switchOffGht). Choice: wire it on ?classic=1 (hud) or delete it with its test.
- **Alert history** (createAlerts in play/teach.mjs, keeps the last 8): no page calls it. Card 8.2 (hud) already wires it to Space.
  Choice: keep if the HUD card lands, otherwise delete.
- **First-minutes coach** (createCoach in play/teach.mjs): no page calls it. Choice: wire it into /play (hud, text from ux-writer)
  or delete it with its tests.
- **Toast moods** (env/toast.mjs): enableToast runs in every territory match (env/sim-territory.mjs enableHunger), but stepToast has
  no caller, so no mood changes, toastAttackScale has no caller, and no UI reads observeToast. Choice: wire the moods into combat
  and a HUD readout (combat plus hud), or delete env/toast.mjs and its three tests.

## Unused samples (assets/audio/MANIFEST.json and the scratch packs)

Events in the manifest that no /play code path plays (app.mjs loads feel.mjs and sound-player.mjs; these names appear only in
tests or the style lab):

- `ambient_loop` (oga-ambient/MyVeryOwnDeadShip.ogg): no caller on /play. Card 8.5 (hud) wires it. Keep if that lands.
- `victory` and `defeat` (kenney-jingles): style lab only. Card 8.4 (hud, tests/result-sound.test.mjs) wires the result stinger.
- `melee_hit` (kenney-impact/impactPunch_medium_000.ogg): named only in sound-player.test.mjs. Wire to combat hits or delete.
- `heavy_impact` (kenney-impact/impactMetal_heavy_000.ogg): no caller. Wire to a heavy hit (combat) or delete.
- `explosion_death` (kenney-sci-fi/explosionCrunch_000.ogg): no caller. Wire to a unit death (combat) or delete.
- `ranged_shot` (kenney-sci-fi/laserSmall_000.ogg): no caller. Wire to a ranged shot (combat) or delete.
- `resource_collected` (kenney-impact/impactMining_000.ogg): no caller. Wire to a Wheat drop-off (economy) or delete.

Folders under assets/audio/_scratch (kenney-impact, kenney-jingles, kenney-scifi, kenney-ui, oga-searching, oga-space): no code
or manifest path reads them. They are candidates for deletion once Joshua confirms; nothing was removed.
