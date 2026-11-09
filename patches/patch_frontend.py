"""Apply text patches to the deployed Mini App bundle and cascade-rename every
changed /assets file (assets are served immutable, so content under an existing
name must never change). Old files are kept so already-open sessions still work."""
import os, re, sys, json
DIST = sys.argv[1]; SUFFIX = sys.argv[2]
PATCHES = json.load(open(sys.argv[3], encoding='utf-8'))
A = os.path.join(DIST, 'assets')
def rd(n): return open(os.path.join(A, n), encoding='utf-8').read()
contents = {}
for p in PATCHES:
    s = contents.get(p['file']) or rd(p['file'])
    if 'append' in p:
        contents[p['file']] = s + p['append']; print('patched', p['name']); continue
    c = s.count(p['old'])
    if c != p.get('count', 1): sys.exit(f"patch {p['name']}: expected 1 match in {p['file']}, got {c}")
    contents[p['file']] = s.replace(p['old'], p['new'])
    print('patched', p['name'])
def newname(n):
    stem, ext = os.path.splitext(n); return f"{stem}-{SUFFIX}{ext}"
renamed = set(contents)
names = [n for n in os.listdir(A) if n.endswith(('.js', '.css')) and f'-{SUFFIX}' not in n]
while True:
    grew = False
    for n in names:
        if n in renamed: continue
        s = contents.get(n) or rd(n)
        if any(r in s for r in renamed):
            renamed.add(n); contents[n] = s; grew = True
    if not grew: break
def rewrite(s):
    for r in sorted(renamed, key=len, reverse=True):
        s = re.sub(r'(?<![A-Za-z0-9_-])' + re.escape(r), newname(r), s)
    return s
for n in renamed:
    out = os.path.join(A, newname(n))
    open(out, 'w', encoding='utf-8').write(rewrite(contents[n]))
html = os.path.join(DIST, 'index.html'); h = open(html, encoding='utf-8').read()
open(html, 'w', encoding='utf-8').write(rewrite(h))
print('renamed', len(renamed), 'files')
