# Perf measurement, 2026-10-25 17:48 (Claude, by hand, in the Control Room browser pane on the Mac mini, real GPU)

Page: http://localhost:4477/preview/rts/play/perf-toaster.html?units=200&quality=high (Recurse #1 fixed its startup crash).

PERF line (verbatim): {"scene":"toaster-wheatfield","seed":7,"units":200,"buildings":12,"points":6,"cordUnits":24,"pluggedUnits":31,"marching":100,"quality":"high","engineQuality":"high","toyTier":{"name":"high","pixelRatio":1.5,"shadowMap":2048},"viewport":{"w":0,"h":0,"dpr":1},"frameMs":{"n":10,"median":1005,"p95":1389.6,"mean":1065.52,"max":1631},"fps":1,"drawCalls":1,"triangles":1,"simTicks":47,"simTickMs":{"n":47,"median":184.4,"p95":560.3,"mean":239.42,"max":915.6},"warmupMs":3000,"measureMs":10000,"passes60":false}

What it means (VERIFIED by reading the line and the screen):
1. The page is SIM-bound, not render-bound: one sim tick takes 184 ms median, 560 ms p95, with 200 units (100 marching) on Wheatfield. At 24 ticks a second the budget is 41.7 ms a tick. The frame loop catches up on ticks each frame, so "frame ms 1005" is sim catch-up, not drawing. No rendering number can be read from this page until the sim is taken out of the frame loop (render a pre-stepped or recorded state, or step the sim in a worker, or cap catch-up to 1 tick for the measurement).
2. The readout is broken in three places: viewport 0x0 (the canvas size is not read), drawCalls 1 and triangles 1 (renderer.info is read after reset or before any draw). The screen shows the creek with ONE toaster and rocks: the camera is not on the 200 units.
3. Headless SwiftShader (the Recurse Team's shots) gives 6183 ms a frame for the same page: software rendering; never use probe PERF numbers for GPU decisions. Real GPU numbers come from this pane (mini) or the MacBook Air.

Open: is the 184 ms tick real for a live match, or an artefact of the synthetic state (100 units re-pathing across the 256x256 map every tick)? PERF.md says congested fights are the expensive path (state.units.some per tile). Owner: engine/gameplay (sonnet), not the graphics room.

## Update 19:12, after Recurse #5-#7 (render-only mode, camera on the crowd), real GPU in the browser pane on the Mac mini

PERF {"scene":"toaster-wheatfield","quality":"high","mode":"render","units":157,"frames":120,"renderMedianMs":1.6,"renderP95Ms":1.9,"simMedianMs":0.3,"fps":625,"drawCalls":37,"triangles":178486,"casters":4475,"viewport":{"w":1024,"h":768,"dpr":1},"inFrame":157,"target":{"x":128,"y":128}}

VERIFIED by eye: 157 of 157 toasters packed in frame at 16 tiles tall, quality high (pixel ratio 1.5, shadow map 2048). Render median 1.6 ms, p95 1.9 ms: about one tenth of the 16.7 ms budget on the mini. 157 not 200 because the sim's unit cap (40 a side) and the scenario's spawn cap limit the crowd; the page says so. The MacBook Air number is still to be measured there (expect several times slower, still likely inside budget).
The earlier 184 ms sim tick stands as a separate, open engine question (sim stepping is frozen in render mode, simMedianMs 0.3 is the frozen cost).
