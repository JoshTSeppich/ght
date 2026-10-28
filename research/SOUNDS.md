# Toastinators — original sound list (PLAYABLE item 26)

Seven original synthesis designs for Sonnet's audio implementation. No recordings,
samples, borrowed melodies or external audio assets. The sound is a tiny disciplined
kitchen army: short mechanical reports, earnest signals, one restrained celebration.
The Sound List studio picker shows a four-part field broadcast console; its attack
is a visual speaker impulse. This document specifies audio; the studio is silent.

All times below are seconds relative to the event. Pitches are Hz, gains linear.
Use OscillatorNode → GainNode → shared master gain → destination. Start each voice
at gain 0, linearly attack to the specified peak, then exponentially decay to 0.0001;
linearly reach 0 during the last 0.005 s and stop/disconnect the oscillator. For
frequency sweeps use exponentialRampToValueAtTime between positive frequencies.
Create fresh voices per event; never reuse an oscillator after stop().

| Sound | WebAudio synthesis recipe | Event and character |
|---|---|---|
| **Pop shot** | Triangle 440 → 95 over 0.065; attack 0.002 to gain 0.18, decay through 0.075, stop 0.080. A square transient at 1320, peak 0.025, attack 0.001, decay 0.012, stop 0.017. | One per actual shot; a compact spring fist, not an explosion. |
| **Toast ding** | Sine 1175, peak 0.12, attack 0.003, decay 0.30, stop 0.305; simultaneous sine 1880 at peak 0.035, attack 0.002, decay 0.13, stop 0.135. | Completed toast batch only. Bright, dry ceramic readiness signal. |
| **Mill creak** | Triangle 137 → 103 by 0.13 → 149 by 0.27, peak 0.045, attack 0.025, decay 0.33, stop 0.335. Parallel sawtooth follows the same pitch at peak 0.008 through a lowpass BiquadFilterNode (480 Hz, Q 0.7). | One stroke per grinding cycle, at most once per 1.4 s per audible Mill. A loaded hinge, never a constant drone. |
| **Crumb chirp** | Two triangle notes: 690 → 860 over 0.055 starting at 0, then 1040 → 920 over 0.065 starting at 0.075. Each attacks in 0.003 to 0.065, decays by its sweep end, stops 0.005 later. | Selected or accepted order; no speech. A very serious two-syllable acknowledgement. |
| **Cord snap** | Square 980 → 120 over 0.035, attack 0.001 to 0.075, decay 0.04, stop 0.045. Triangle 155 → 62 over 0.11, attack 0.002 to 0.09, decay 0.12, stop 0.125. | Confirmed sever only; sharp contact then elastic recoil. No noise buffer needed. |
| **Strip alarm** | Three triangle pulses at offsets 0, 0.21, 0.42, pitches 370, 495, 370. Each attacks 0.008 to 0.10, holds through 0.045, decays through 0.13, stops 0.135. | Own Strip under attack. Distinct lower register; repeat no faster than once per 3 s while threat persists. |
| **Victory jingle** | Four triangle notes at offsets 0, 0.14, 0.31, 0.53, pitches 523, 697, 784, 1046. Peaks 0.10, attacks 0.008; durations 0.12, 0.15, 0.18, 0.42 including decay and final 0.005 zero ramp. Final note adds sine 1569 at peak 0.025 with the same envelope. | Play once on local victory. A brisk original kitchen roll-call, under one second. |

Integration: resume AudioContext only after a user gesture, honour mute and master
volume, and schedule using context.currentTime. Master gain starts at 0.45; a
DynamicsCompressorNode before destination catches overlapping transients. Cap active
voices at 24; steal oldest shot/creak voices before any alarm. Stop stolen voices
with a 0.005 s gain ramp. Coalesce same-frame shot bursts to four reports, and throttle
Crumb acknowledgements to one per 0.25 s for the whole selection. Cull off-camera
Mill creaks; pan on-screen world cues with StereoPannerNode (−0.7 to +0.7).
Toast-ready, order replies, alarm and victory remain centred. These are audio
presentation limits, with no simulation effects. All alarm meaning also remains visible.
