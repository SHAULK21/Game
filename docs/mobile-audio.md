# Mobile audio compatibility

Telegram Android/iOS platforms and mobile user agents use a reusable pool of five HTMLAudioElements. Desktop browsers keep the existing Web Audio mixer, with HTML media fallback if initialization or decoding fails. The compatible transport avoids depending on AudioContext state to conclude that a mobile device is producing sound.

The pool is primed synchronously during touch/pointer/click gestures with `public/assets/audio/unlock.wav`: a locally authored 50 ms silent mono PCM WAV (8 kHz, 16 bit). Cue files are warmed in the browser cache after a gesture. Existing shuffle bags, attack throttle, mute preference, background stop and delayed-effect cancellation are preserved. Ordinary media starts time out after 300 ms to avoid late bursts; the explicit check allows 3 seconds and reports failure without blocking gameplay.

Both More screens provide shared mute controls and **Check sound**. The check enables sound, selects compatible playback and starts an existing bell recording directly from the click. Successful play() means playback started, not proof that the device speaker is audible. System media volume, browser settings and Telegram audio policies can still affect output. The desktop header subscribes to the same setting, preventing stale mute indicators.

Validation: audio unit tests cover an Android Telegram platform with unusable Web Audio, gesture unlocking, reusable media elements, mute, hidden-page stop and retained throttling. Chromium mobile emulation with autoplay restrictions and AudioContext forced to throw verified actual bell/attack MP3 progress. Existing interface tests passed. Physical Android/iOS Telegram sessions were not available.
