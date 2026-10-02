# Fantasy shell ornament candidate v1

Standalone artwork created for the approved dark HUD and shared bottom navigation direction shown in the World and Inventory references. This atlas is not a screenshot of the game or an interactive UI.

## Review status

Awaiting the author's visual approval. No game component consumes this candidate yet. Approving the overall style does not establish pixel-perfect reference fidelity or validated responsive behavior.

The atlas contains an empty HUD frame, inactive and active navigation frames, and a divider. Text, values, icons, actions and accessibility labels must remain in React components.

## Files and assembly

- `ornaments.webp`: RGBA, 1254 × 1254; WebP encoding at quality 92 with alpha preserved.
- `manifest.json`: padded region bounds. These bounds exclude the faint alpha noise elsewhere in the generated sheet.
- `prompt.txt`: exact generation specification.

Do not stretch corners, center diamonds, curls or other ornament. Establish fixed-size corner and ornament regions and repeat only straight edge segments when implementing the responsive shell. The region bounds alone are not an approved nine-slice map. Browser screenshot comparison is required before shipping the consuming UI.

Generated with the built-in image generation tool using `photo_2026-10-02_20-56-03.jpg` as a style reference, then encoded as WebP without resizing. No source screenshot pixels are used in the atlas.
