from PIL import Image, ImageDraw, ImageFont, ImageFilter
W, H = 1280, 720
src = Image.open('/home/user/serverless-game/dist/assets/game_monster_dragon_1790595120603-CCCJDlq2.jpg').convert('RGB')
bg = src.resize((1280, 1280)).crop((0, 230, 1280, 950))
bg = bg.transform((W, H), Image.AFFINE, (1, 0, -260, 0, 1, 0)) if False else bg
img = bg.copy()
# left-to-right dark gradient + bottom vignette
grad = Image.new('L', (W, H))
gd = ImageDraw.Draw(grad)
for x in range(W):
    a = int(max(0, min(255, 262 - (x / W) * 250)))
    gd.line([(x, 0), (x, H)], fill=a)
dark = Image.new('RGB', (W, H), (10, 8, 6))
img = Image.composite(dark, img, grad)
d = ImageDraw.Draw(img, 'RGBA')
for y in range(H):
    t = max(0, (y - H * 0.6) / (H * 0.4))
    d.line([(0, y), (W, y)], fill=(8, 6, 4, int(180 * t)))
GOLD, LIGHT = (229, 198, 120), (246, 226, 170)
serif = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
sans = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
# crown
cx, cy, s = 120, 175, 1.0
crown = [(cx, cy + 70), (cx, cy), (cx + 40, cy + 38), (cx + 75, cy - 18), (cx + 110, cy + 38), (cx + 150, cy), (cx + 150, cy + 70)]
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(glow).polygon(crown, fill=(255, 200, 90, 160)); glow = glow.filter(ImageFilter.GaussianBlur(18))
img.paste(glow, (0, 0), glow); d = ImageDraw.Draw(img, 'RGBA')
d.polygon(crown, fill=GOLD, outline=(120, 85, 30)); d.rectangle([cx, cy + 74, cx + 150, cy + 92], fill=GOLD)
for px, py in [(cx, cy), (cx + 75, cy - 18), (cx + 150, cy)]: d.ellipse([px - 9, py - 9, px + 9, py + 9], fill=(150, 220, 255))
d.text((cx + 175, cy + 8), 'AETHELGARD', font=ImageFont.truetype(serif, 34), fill=LIGHT)
d.text((cx + 175, cy + 48), 'R P G', font=ImageFont.truetype(sans, 22), fill=(200, 180, 140))
title = ImageFont.truetype(serif, 118)
tg = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(tg).text((110, 300), 'PREMIUM', font=title, fill=(255, 190, 80, 200)); tg = tg.filter(ImageFilter.GaussianBlur(14))
img.paste(tg, (0, 0), tg); d = ImageDraw.Draw(img, 'RGBA')
d.text((110, 300), 'PREMIUM', font=title, fill=GOLD, stroke_width=2, stroke_fill=(90, 60, 20))
d.text((114, 450), 'Добро пожаловать в ряды избранных!', font=ImageFont.truetype(serif, 40), fill=LIGHT)
d.text((114, 512), 'Автобой · офлайн-добыча · +5 слотов · VIP-метка', font=ImageFont.truetype(sans, 28), fill=(215, 205, 185))
d.line([(114, 575), (620, 575)], fill=(229, 198, 120, 180), width=2)
d.text((114, 592), 'Сила королевства теперь с вами', font=ImageFont.truetype(sans, 26), fill=(200, 180, 140))
img.save('premium-welcome.jpg', quality=84, optimize=True, progressive=True)
img.resize((640, 360)).save('premium-welcome-preview.png')
print('saved')
