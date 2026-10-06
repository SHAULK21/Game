# PR86 implementation: fantasy beta book fixes

Reference: https://github.com/SHAULK21/Game/pull/86 (documentation only).

This change implements the tap/Back stage for the beta bestiary. The inspected
1024×1536 book texture has a spine in approximately its left 6.5%; this strip
remains stationary while the parchment leaf rotates around its left edge.
An inert DOM copy carries the visible list content. It is not a second mounted
game component and does not duplicate effects, requests, or combat actions.
The reverse transition uses the stored list copy, restores scroll and focuses
the selected creature. The forward transition focuses the dossier heading.
Repeated navigation is ignored during movement; resize, motion-preference change,
timeout and unmount complete or cancel the temporary layer. Child animation events
cannot finish the controller. The HUD/navigation remain visible and usable.
Reduced motion and missing CSS 3D use a short fade. Interactive swiping remains
in the follow-up stage described by PR86; no router or audio system was added.

The bag uses a single stationary book background instead of repeated full books.
Equipment is a native expandable section; item cards retain full names, quantities,
rarities and actions. Empty equipment slots are more compact, badges remain legible,
and expansion controls wrap at narrow widths. Stable fantasy and modern layouts
retain their existing structure and styling.

Validation: TypeScript, production build and repository tests. DOM regression
coverage checks repeat navigation, child animation events, resize cleanup, focus,
unmount cleanup, bag expansion, item dialogs, and shared progress across styles.
No desktop visual browser, Android Chrome or iOS Safari verification was performed
in this execution environment. The flat CSS 3D leaf is not a physical page curl.
