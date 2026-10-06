# iPhone interface adaptation

Scope: modern, stable fantasy and fantasy beta. Combat/balance, saves and account
logic were not changed. Shared viewport handling covers registration, stories,
dialogs, selection sheets and game navigation.

Changes:
- Browser safe-area insets and Telegram device/content insets share one CSS contract.
  Sticky headers include the top inset; bottom navigation and scrollable screens
  reserve the bottom inset. Landscape content respects left/right insets.
- VisualViewport and Telegram viewport events update sheet height. Focused inputs
  stay visible when the keyboard reduces the viewport; pinch zoom is not classified
  as a keyboard. Observers/listeners and pending frames are cleaned up.
- Coarse-pointer inputs use 16px text; page zoom remains available. Small close and
  attribute controls have 44px touch targets. Text selection works in editable fields.
- Beta book/dossier/page-turn bounds follow the measured HUD and safe bottom area.
  Explicit monster-card width prevents WebKit from shrinking aspect-ratio buttons
  with only absolutely positioned children to zero size.
- Narrow modern resource badges wrap; beta bestiary heading/filter and item comparisons
  adapt to narrow screens. Alchemy action buttons stack under recipes below 390px.
- The beta searchable picker now has a styled, scrollable parchment sheet.

Validation used Playwright WebKit 26.5 on Linux with touch/mobile emulation, not
physical iPhones or the Telegram iOS app. API responses were mocked; backend/payment
operations were not exercised. The fixture used a level-one hero, a long name and
large currency balances. This does not cover every progression, multiplayer or
administrative data state.

| Profile | CSS viewport | Simulated safe insets |
| --- | --- | --- |
| Small legacy width | 320 × 568 | 0 |
| SE width | 375 × 667 | 0 |
| Notch portrait | 390 × 844 | top 47, bottom 34 |
| Max portrait, Ukrainian | 430 × 932 | top 59, bottom 34 |
| Landscape | 844 × 390 | bottom 21, left/right 44 |

The matrix visited 16 navigation destinations in each of the three themes at each
size (240 views). It found four clipped alchemy buttons in each fantasy theme at
320px. After the fix, all 48 views at 320px were repeated with no horizontal control
overflow. Item sheets in all three themes fit between the simulated top/bottom
insets. After the WebKit card-width fix, monster-card dimensions, opening the
dossier between HUD/navigation and restoring focus on Back were checked at all
five sizes. Modern and beta searchable pickers were additionally checked with a
simulated 480px visible viewport and 16px search input text. Two WebKit access-control
messages occurred during reloads of the mocked preferences request in focused runs;
no live-server CORS conclusion is drawn from those messages.

TypeScript, production build and all 174 repository tests pass. The three new
viewport tests cover keyboard/zoom distinction, focus and restoration, Telegram
safe-area changes, listener cleanup, pending-frame cancellation and missing SDK/API
fallbacks.

Platform references:
- https://core.telegram.org/bots/webapps#safeareainset
- https://core.telegram.org/bots/webapps#contentsafeareainset
- https://webkit.org/blog/7929/designing-websites-for-iphone-x/
- https://webkit.org/blog/9674/new-webkit-features-in-safari-13/
