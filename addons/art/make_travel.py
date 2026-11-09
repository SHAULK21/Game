from PIL import Image, ImageDraw
A = '/home/user/serverless-game/dist/assets/'
SRC = ['game_hero_hunter_1790595108742-wgn-kliT.jpg', 'woods-nWSh73gt.webp', 'game_dungeon_cave_1790595131021-MauFE7Cn.jpg', 'desert-CWB6P9JN.webp', 'char_warrior_paladin_1790595905774-BjMNog-W.jpg']
W, H = 720, 400
for i, f in enumerate(SRC, 1):
    im = Image.open(A + f).convert('RGB'); w, h = im.size
    scale = max(W / w, H / h); im = im.resize((int(w * scale) + 1, int(h * scale) + 1), Image.LANCZOS)
    w, h = im.size; top = max(0, int((h - H) * 0.35)); im = im.crop(((w - W) // 2, top, (w - W) // 2 + W, top + H))
    d = ImageDraw.Draw(im, 'RGBA')
    for y in range(H):
        t = max(0, (y - H * 0.45) / (H * 0.55)); d.line([(0, y), (W, y)], fill=(8, 6, 4, int(215 * t)))
    im.save(f'travel-{i}.webp', quality=80)
print('ok')
