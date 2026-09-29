# Aethelgard item art

The game can display local Canva item art from this folder.

Export the four generated Canva sheets at original resolution and place them in:

`canva_item_sheets/equipment-sheet.jpg`
`canva_item_sheets/unique-sheet.jpg`
`canva_item_sheets/resources-sheet.jpg`
`canva_item_sheets/potions-sheet.jpg`

Then run:

`python scripts/split_item_icon_sheets.py`

The script creates 256×256 WebP icons in this folder. The UI automatically falls back to the existing emoji/SVG icon when a local artwork file is missing.
