"""Shrink images in dist/assets in place (same names, so the game needs no changes).
python3 patches/optimize_images.py dist [--dry]
- UI icons (ui/icons, ui/resources, ui/gear): shown at <= 42 css px -> max side 128 px.
- Large art (heroes, monsters, arena, regions, story, backgrounds): same size, re-encoded; kept only if >= 15 % smaller.
Originals stay in git history."""
import os, sys, io
from PIL import Image
DIST = sys.argv[1]; DRY = '--dry' in sys.argv
A = os.path.join(DIST, 'assets')
ICON_DIRS = ['sprites/generated/ui/icons', 'sprites/generated/ui/resources', 'sprites/generated/ui/gear']
ART_DIRS = ['sprites/generated/heroes', 'sprites/generated/heroes/combat', 'sprites/generated/monsters', 'sprites/generated/pets/combat', 'arena', 'story', 'travel', 'fishing', 'dungeons', 'world', 'modern', 'splash', 'sprites/generated/ui', 'sprites/generated/ui/shell-v1', 'sprites/reference', 'sprites/reference/approved-parts']
ART_ROOT_EXT = ('.webp', '.jpg')  # hashed backgrounds directly in assets/ (plains-*.webp, premium-welcome-v1.jpg…)
def encode(im, fmt, q):
    b = io.BytesIO()
    if fmt == 'WEBP': im.save(b, 'WEBP', quality=q, method=6, alpha_quality=90 if im.mode == 'RGBA' else 100)
    else: im.convert('RGB').save(b, 'JPEG', quality=q, optimize=True, progressive=True)
    return b.getvalue()
def process(path, max_side=None, q=80, need_gain=0.15):
    old = os.path.getsize(path); im = Image.open(path); fmt = 'WEBP' if path.endswith('.webp') else 'JPEG'
    im.load(); im = im.convert('RGBA') if im.mode in ('P', 'LA', 'RGBA') or 'transparency' in im.info else im.convert('RGB')
    if max_side and max(im.size) > max_side:
        k = max_side / max(im.size); im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
    data = encode(im, fmt, q)
    if len(data) > old * (1 - need_gain): return old, old
    if not DRY: open(path, 'wb').write(data)
    return old, len(data)
tot = [0, 0]
def run(rel, **kw):
    p = os.path.join(A, rel)
    o, n = process(p, **kw); tot[0] += o; tot[1] += n
    return o, n
groups = {}
for d in ICON_DIRS:
    if not os.path.isdir(os.path.join(A, d)): continue
    for f in sorted(os.listdir(os.path.join(A, d))):
        if f.endswith('.webp'): o, n = run(f'{d}/{f}', max_side=128, q=88, need_gain=0.05); g = groups.setdefault(d, [0, 0]); g[0] += o; g[1] += n
for d in ART_DIRS:
    full = os.path.join(A, d)
    if not os.path.isdir(full): continue
    for f in sorted(os.listdir(full)):
        if f.endswith(('.webp', '.jpg')) and os.path.isfile(os.path.join(full, f)): o, n = run(f'{d}/{f}', q=78); g = groups.setdefault(d, [0, 0]); g[0] += o; g[1] += n
for f in sorted(os.listdir(A)):
    if f.endswith(ART_ROOT_EXT) and os.path.isfile(os.path.join(A, f)): o, n = run(f, q=78); g = groups.setdefault('(assets root)', [0, 0]); g[0] += o; g[1] += n
for d, (o, n) in groups.items(): print(f'{d:42s} {o // 1024:6d} KB -> {n // 1024:6d} KB')
print(f'TOTAL {tot[0] // 1024} KB -> {tot[1] // 1024} KB' + (' (dry run)' if DRY else ''))
