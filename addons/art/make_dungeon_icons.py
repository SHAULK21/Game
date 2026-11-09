from PIL import Image, ImageDraw, ImageFilter
M = '/home/user/serverless-game/dist/assets/sprites/generated/monsters/'
ICONS = {'bat_cave': 'm_queen_bat', 'old_mine': 'm_stone_golem', 'spider_lair': 'm_spider_queen', 'catacombs': 'm_death_knight_boss',
         'demon_rift': 'm_demon_lord', 'dragon_cave': 'm_dragon_boss', 'goblin_cave': 'm_goblin', 'crypt_depths': 'm_cursed_soldier', 'rift_gate': 'm_ash_imp', 'spider_den': 'm_spider'}
S = 160
sheet = Image.new('RGBA', (S * len(ICONS), S), (0, 0, 0, 0))
for i, (key, sprite) in enumerate(ICONS.items()):
    src = Image.open(M + sprite + '.webp').convert('RGBA')
    bbox = src.getbbox() or (0, 0, *src.size); src = src.crop(bbox)
    w, h = src.size; side = max(w, h)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0)); sq.paste(src, ((side - w) // 2, max(0, (side - h) // 3)), src)
    sq = sq.resize((S - 22, S - 22), Image.LANCZOS)
    tile = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(tile)
    d.ellipse([4, 4, S - 4, S - 4], fill=(28, 22, 16, 255))
    glow = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ImageDraw.Draw(glow).ellipse([18, 18, S - 18, S - 18], fill=(214, 170, 90, 90)); glow = glow.filter(ImageFilter.GaussianBlur(16))
    tile.alpha_composite(glow)
    mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).ellipse([8, 8, S - 8, S - 8], fill=255)
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0)); layer.paste(sq, (11, 11), sq)
    tile.paste(layer, (0, 0), Image.composite(layer, Image.new('RGBA', (S, S)), mask).split()[3])
    d = ImageDraw.Draw(tile); d.ellipse([4, 4, S - 4, S - 4], outline=(214, 180, 110, 255), width=5); d.ellipse([10, 10, S - 10, S - 10], outline=(90, 64, 30, 255), width=2)
    tile.save(f'dungeon-{key}.webp', quality=86); sheet.paste(tile, (i * S, 0))
sheet.save('dungeon-icons-preview.png'); print('ok')
