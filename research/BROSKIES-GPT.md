# Broskies — everyone has a guest list
GPT art direction · 27 October 2026 · proposal, not simulation rules.

## Read of the old lab
In rooms/graphics/shots/faction-lab-joshua.png, the Broskies share cube heads,
rectangular jackets and straight rectangular limbs. Tiny handheld planes cannot
communicate six jobs. Keep the existing Host, Corkshot, Confetti-bomber, Bouncer,
DJ and Hype-captain identities; replace the repeated anatomy and broaden their company.
The companion play/broskie-lab.html is the proposed after: three shape studies and
four enlarged applications. It does not replace the live fixture or restore model v2.

## Roster: twelve entries, not twelve kinds of drinking
All attacks deal overstimulation damage; food and props are theatrical delivery
systems, never realistic weapons. Tier assignments below are proposals.

| Unit / building | Host archetype and RTS role | Party attack / function |
|---|---|---|
| Place-setter | Dinner host; T1 worker | Harvests Wheat, lays tables; close-range tray clang for defence. |
| Corkshot | Frat-party brewer; T1 basic fighter | Beer-pong bounce shot; blue jacket, narrow stance, tilted bottle launcher. |
| Confetti-bomber | Kids' birthday entertainer; T2 siege | Braces a popper pack to lob a clearly marked confetti burst; purple fan-shaped coat and party hat. |
| Bouncer | Block-party doorkeeper; T2 tank | Rope-post sweep and an overwhelming hand-clap; broad low shoulders, small head, dark jacket. |
| DJ | Dance-party host; T2 ranged | Directed bass pulses from a speaker backpack; teal jacket, headphones, forward lean. |
| Seating Marshal | Wedding planner; T2 support/healer | Idle snack service restores nearby friends; invitation flurry briefly disrupts enemy aim. |
| Grill Captain | Tailgate griller; T2 siege | Rolling grill launches sizzling snack volleys; broad apron, angular smoke cue only on firing. |
| Agenda Host | Office-party coordinator; T1 support | Rapid announcements overload one target; clipboard marks a local setup rally. |
| Table Caller | Game-night host; T1 ranged | Oversized tumbling game tiles ricochet once; low seated silhouette on a folding stool. |
| Hype-captain | Rooftop-party host; T3 air | Cap and megaphone, orange jacket; rides a five-panel tetherless festival kite and projects a narrow cheer cone. |
| Host | Brunch host; hero | Retains top hat and clipboard; tray flourish sends a wave of applause, rallies idle regeneration. |
| Open House | Block-party organizer; headquarters / production building | Folded awning, communal table and five-sided drink vat; converts Wheat and dispatches workers. Bell peals defend only at close range. |

Archetypes describe a job, not a gender, age, skin tone or social class. Mix short,
tall, broad, lean and seated hosts; vary skin and hair across every role. Keep
silhouette and equipment readable without colour. Alcohol belongs to Corkshot's
brew line; birthday and other hosts use snacks, juice and sound.

## Economy and territory: the Afterparty
Wheat delivered to Open House becomes a shared **Refreshments** stock: brewing
beer, mixing grain drinks and baking snacks are visible production choices,
not three new currencies. Refreshments pay for attacks and idle recovery;
no stock means slower attacks, not immobile humans. This is a design proposal;
any implementation must explicitly opt out of Toasties' default toast ammo.

Hosts walk on any traversable ground without a cord or hallowed-ground requirement;
this does not imply crossing cliffs or deep water. They move slowly, checking
lists as they go, and need a stationary setup before their strongest attacks.
Nearby idle friends regenerate together after combat ends, consuming Refreshments;
no stacking extra healing by packing more hosts into one point.

Moving groups leave an **Afterparty trail**: a few flat trash wedges, confetti
patches and generic printed post-card glyphs. Posts are local in-world publicity,
not real platforms, online activity, free map vision or a floating particle cloud.
A fresh trail connected to an occupied Open House supports faster setup and cheaper
refreshment delivery. A lone scout can leave litter but cannot establish supply.
Enemy occupation interrupts the connection; unattended sections fade, and enemy
workers can clean them. Neither litter nor posts block movement. Use discrete
fading tile marks and a sparse boundary, with a distinct broken state.

This proposes replacing the earlier roads with the trail, pending Joshua's decision
noted in FACTIONS.md. It does not silently add both bonuses. Unlike Ghosties,
Broskies still fight off territory; unlike Toasties, they have no hard tether.
Their advantage rewards preparing a route and regrouping, with counterplay through
cutting the party's supply and forcing it to move before setup finishes.

## Three geometric human directions
1. **Folded Guests — chosen.** A five-sided cheek-and-chin head with an angled hair
   plane, a flared folded jacket, tapered bent limbs and wedge shoes. Shoulder and
   hip folds have different widths. Two visible skin hands, a neck gap, two eyes
   and one decisive lean establish a person. Use broad flat facets, not outlines
   around a collection of rectangular bricks. Vary body ratio and stance per job.
2. **Cut-Gem People.** Five-sided gemstone heads, separated shoulder and pelvis
   stones, five-sided elbow and knee joints. Limbs taper between joints. Stocky
   weight shifts make characters look carved. Strong family resemblance to the
   porcelain ghosts, but too many isolated joint shapes at gameplay size.
3. **Ribbon Hosts.** A folded strip makes the coat, another forks into two angular
   trouser ribbons. A shallow pentagonal face sits above an open neck notch.
   Hands are flat five-sided tabs; gestures describe big zigzags. Excellent pose
   clarity, but a thin torso risks disappearing from the strategy camera.

**Choose Folded Guests:** solid mass holds up next to the Toasties' appliance
blocks and Ghosties' five-sided porcelain shells. The human neck, cheek, hands,
clothing folds and asymmetric stance give a third family without smooth surfaces
or cube-head anatomy. Keep the Toasties' section-0 simplicity as a complexity guide,
not a requirement to give humans appliance bodies. Production should start with a
small independent-pivot rig; measure triangle and instance costs before promising
v2 budgets. This study claims no renderer or performance validation.

Retain FACTION_COLORS.hosters coral #C35D51, charcoal #353A48 and gold #E5B75B;
add cream cloth, plum and teal for role cues and multiple skin tones. Team marks
remain one shoulder patch. Eyes and a small nose facet face forward and upward.
The static lab uses #F7F0DF text on #202B31 panels (over 12:1) and #BDC9C9 secondary
text (over 8:1); all page text exceeds 4.5:1. Art colours are not text colours.

## Review and next implementation gate
Review the silhouettes at 64 pixels, then test each in the actual tilted camera.
The four lab applications preserve Host, Bouncer, DJ and Confetti-bomber cues;
the remaining roster is design, not implemented art. Existing faction-model v2
CUTENESS/face failures are outside this final two-file scope and remain unresolved.
