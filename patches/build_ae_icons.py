"""Build the add-on icon atlas from the game's own icons: one 64 px cell per icon.
python3 patches/build_ae_icons.py dist v1   -> dist/assets/ae-icons-v1.webp and the JSON map on stdout"""
import os, sys, json, math
from PIL import Image
DIST, VER = sys.argv[1], sys.argv[2]
A = os.path.join(DIST, 'assets')
SRC = 'sprites/generated/ui'
NAMES = [('icons', n) for n in ['gold', 'silver', 'energy', 'attack', 'defend', 'hp', 'clan', 'crown', 'forge', 'arena', 'quest', 'map', 'hunt', 'potion', 'skill',
          'monster', 'mine', 'inventory', 'settings', 'refresh', 'character', 'bestiary', 'compass', 'alchemy', 'market', 'stamina']] + \
        [('resources', n) for n in ['crystal', 'coin', 'spark', 'key', 'badge', 'ore', 'herb', 'fang']] + \
        [('@src', n) for n in ['bell', 'mail', 'gift', 'hammer', 'blade', 'zoom', 'paw', 'ticket', 'megaphone', 'news', 'coop', 'friends', 'book', 'chat', 'trophy', 'moon', 'calendar']]
HERE = os.path.dirname(os.path.abspath(__file__))
CELL, PAD = 64, 3
cols = 6; rows = math.ceil(len(NAMES) / cols)
atlas = Image.new('RGBA', (cols * CELL, rows * CELL), (0, 0, 0, 0)); index = {}
for i, (d, n) in enumerate(NAMES):
    im = Image.open(os.path.join(HERE, 'ae-icons-src', n + '.png') if d == '@src' else os.path.join(A, SRC, d, n + '.webp')).convert('RGBA')
    bb = im.getbbox(); im = im.crop(bb) if bb else im           # trim transparent margins so icons fill the cell
    im.thumbnail((CELL - 2 * PAD, CELL - 2 * PAD), Image.LANCZOS)
    x, y = (i % cols) * CELL, (i // cols) * CELL
    atlas.alpha_composite(im, (x + (CELL - im.size[0]) // 2, y + (CELL - im.size[1]) // 2))
    index[n] = [i % cols, i // cols]
out = os.path.join(A, f'ae-icons-{VER}.webp'); atlas.save(out, 'WEBP', quality=90, method=6, alpha_quality=95)
print(json.dumps({'cols': cols, 'rows': rows, 'icons': index}, separators=(',', ':')))
print(f'{out}: {atlas.size} {os.path.getsize(out) // 1024} KB', file=sys.stderr)
