# Fantasy shell ornament candidate v1

Standalone artwork created for the approved dark HUD and shared bottom navigation direction shown in the World and Inventory references. This atlas is not a screenshot of the game or an interactive UI.

## Review status

The author approved this artwork on 2026-10-02. Shared fantasy HUD and navigation components consume the atlas. Approving the overall style does not establish pixel-perfect reference fidelity or validated responsive behavior.

The atlas contains an empty HUD frame, inactive and active navigation frames, and a divider. Text, values, icons, actions and accessibility labels must remain in React components.

## Files and assembly

- `ornaments.webp`: RGBA, 1254 × 1254; WebP encoding at quality 92 with alpha preserved.
- `manifest.json`: padded region bounds. These bounds exclude the faint alpha noise elsewhere in the generated sheet.
- `prompt.txt`: exact generation specification.

Do not stretch corners, center diamonds, curls or other ornament. Establish fixed-size corner and ornament regions and repeat only straight edge segments when implementing the responsive shell. ShellOrnament preserves fixed-size corners and center accents, and repeats sampled straight edges at a uniform scale. Browser screenshot comparison is required before shipping the consuming UI.

Generated with the built-in image generation tool using `photo_2026-10-02_20-56-03.jpg` as a style reference, then encoded as WebP without resizing. No source screenshot pixels are used in the atlas.


Browser verification: Chromium 151, World/Inventory/Arena/Hunt at 320, 360, 390 and 768 px; no horizontal overflow. Checked long nickname, large balances, energy dialog, More drawer and appearance controls. Screen bodies still use their existing layouts and remain separate redesign steps.
