from PIL import Image, ImageDraw
A = '/home/user/serverless-game/dist/assets/'
R = {'reg_plains': 'plains-DfAnHj7l.webp', 'reg_whisper_woods': 'woods-nWSh73gt.webp', 'reg_forgotten_crypt': 'crypt-BTumbge1.webp', 'reg_forest': 'forest-B0c-87GO.webp', 'reg_swamp': 'swamp-DLuFAhXR.webp',
     'reg_desert': 'desert-CWB6P9JN.webp', 'reg_cursed': 'cursed-Lvsw06at.webp', 'reg_rift': 'rift-DTdreQra.webp', 'reg_dragon': 'cave-dragon-C5DdFomJ.webp'}
S = 128
sheet = Image.new('RGBA', (S * len(R), S))
for i, (k, f) in enumerate(R.items()):
    im = Image.open(A + f).convert('RGB'); w, h = im.size; side = min(w, h)
    im = im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2)).resize((S, S), Image.LANCZOS)
    mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).ellipse([4, 4, S - 4, S - 4], fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0)); out.paste(im, (0, 0), mask)
    d = ImageDraw.Draw(out); d.ellipse([4, 4, S - 4, S - 4], outline=(214, 180, 110, 255), width=5); d.ellipse([10, 10, S - 10, S - 10], outline=(70, 50, 24, 200), width=2)
    out.save(f'region-{k}.webp', quality=86); sheet.paste(out, (i * S, 0))
sheet.save('region-icons-preview.png'); print('ok')
