# Flutter inventory pilot

The inventory route in modern, fantasy and fantasy-beta now mounts the same real
Flutter Web view. All other screens and the authoritative TypeScript/Rust game
engine remain in place. The existing inventory can be opened using the small
«Обычный инвентарь» button; it is also used if Flutter cannot initialize.

## Runtime

`FlutterInventoryScreen` lazily fetches a no-store release manifest only when the
inventory is visited. One CanvasKit engine is retained for the document lifetime.
`addView` attaches a view to the React host and `removeView` detaches it on tab
changes. Flutter uses local renderer files and bundled Cyrillic/symbol fonts.
No service worker, external renderer CDN, new backend, or separate account is used.

The bridge projects inventory presentation data, effective stats, enhancement tiers
and translated labels. It does not send session credentials or private actor state
to Dart. Whitelisted actions resolve IDs from the current React game projection
and use the existing game context and server operation journal. Equipping, locking,
selling, disassembling, bag expansion and Premium bulk actions retain server rules.
Destructive actions show a confirmation with the selected items. Bulk protection
covers sharpening and merging; confirmed IDs are checked against current items.

## Build

Pinned Flutter: **3.47.7 stable**. Set `FLUTTER_BIN` to an SDK executable, put
Flutter on PATH, or install the SDK at the ignored `.migration-backups/flutter-sdk`.
`npm run build:telegram` builds Flutter before Vite, then the existing native engine.
The Dart/CanvasKit output is copied under a content-versioned `/flutter-inventory/`
directory. `/flutter-inventory.json` is not cached. Unused Skwasm/Wimp variants,
debug symbol files and service workers are excluded from publication.

Windows shader tools do not accept Cyrillic SDK paths. The build script therefore
uses a disposable ASCII copy of the SDK/project under the OS temporary directory
when necessary. The repository remains the source of truth. Never edit the copy.

Checks:

```
npm run flutter:build
npm run flutter:analyze
npm run flutter:test
npm run lint
npm test
npm run build:telegram
node scripts/audit-flutter-inventory.mjs
npm run serverless:audit
```

Flutter widget tests exercise a 320-pixel-wide layout, search, enhancement display,
item identity, protected equipment and disabled commands outside the settlement.
JS integration tests cover bridge ownership, enhanced stats, bulk protection,
single-engine lifecycle, fresh projections, duplicate taps and view teardown.
Real browser checks use synthetic items; production characters are not modified.

This is a pilot, not a measured performance improvement. First inventory entry
downloads the Flutter renderer. Telegram on physical Android/iOS devices still
needs user feedback; the regular inventory remains immediately available.
