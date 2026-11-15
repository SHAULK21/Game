# Builds addons/item-sources.json: resource name -> where to get it (from the game's own data tables).
import re, json, glob, sys
A = '/home/user/serverless-game/dist/assets/'
idx = open(glob.glob(A + 'index-*.js')[0]).read() if False else open(sorted(glob.glob(A + 'index-Bqyd-ipJ-*.js'), key=len)[-1]).read()
mine = open(sorted(glob.glob(A + 'MiningScreen-B9ovIXnw-*.js'), key=len)[-1]).read()
src = {}
def add(name, text, w):
    src.setdefault(name, [])
    if not any(t == text for t, _ in src[name]): src[name].append((text, w))
regions = dict(re.findall(r'\{id:`(reg_\w+)`,name:`([^`]+)`', idx))
veins = re.findall(r'\{id:`(ore_\w+)`,name:`([^`]+)`,levelReq:(\d+),oreYield:`([^`]+)`', idx)
vein_name = {}
for vid, vname, lv, ore in veins:
    vein_name[vid] = (vname, int(lv))
    add(ore, f'⛏ {vname} · горное дело {lv}', int(lv))
# gems found while mining a vein
for vid, body in re.findall(r'(ore_\w+):\[(\{name:`[^\]]*?)\]', idx + mine):
    if vid not in vein_name: continue
    vname, lv = vein_name[vid]
    for name, ch in re.findall(r'\{name:`([^`]+)`,icon:`[^`]*`,rarity:`\w+`,chance:([\d.]+)', body):
        add(name, f'⛏ {vname}, {round(float(ch) * 100)}% · горное дело {lv}', lv + 0.5)
# mining expeditions / Premium offline mining
m = re.search(r'me=\[(\{id:`coal`.*?)\]', idx)
for name, typ, lv in re.findall(r'name:`([^`]+)`,icon:`[^`]*`,type:`(\w+)`,rarity:`\w+`,minLevel:(\d+)', m.group(1)):
    add(name, f'⛏ Экспедиция в шахте · горное дело {lv}', int(lv) - 0.5)
# monster drops
for mid, mname, reg, lv, body in re.findall(r'\{id:`(m_\w+)`,name:`([^`]+)`,regionId:`(\w+)`,level:(\d+),.*?drops:\[(.*?)\]', idx):
    for name, ch in re.findall(r'itemName:`([^`]+)`,type:`(?:material|ore|gem|resource|potion)`,rarity:`\w+`,chance:([\d.]+)', body):
        add(name, f'⚔️ {re.sub(r" \\(.*?\\)", "", mname)} · {lv} ур., {round(float(ch) * 100)}%', int(lv))
out = {k: [t for t, _ in sorted(v, key=lambda x: x[1])][:3] for k, v in src.items()}
print(len(out), 'veins', len(veins), 'regions', len(regions))
for k in ['Драконит', 'Осколок драконьей чешуи', 'Драконья искра', 'Мифриловая руда', 'Арканная пыль', 'Магическая эссенция', 'Руническое ядро', 'Осколок титана', 'Волчья шкура', 'Звёздное ядро']: print(k, '→', out.get(k))
# fishing: fish -> spots
fish = dict(re.findall(r'\{id:`(\w+)`,name:`([^`]+)`,rarity:`\w+`,min:\d+,max:\d+,price:\d+', idx))
for sid, sname, hl, fl, lst in re.findall(r'\{id:`(\w+)`,name:`([^`]+)`,description:`[^`]*`,heroLevel:(\d+),level:(\d+),fish:\[([^\]]*)\]', idx):
    for fid in re.findall(r'`(\w+)`', lst):
        if fid in fish: add(fish[fid], f'🎣 {sname} · рыбалка {fl}', int(fl))
out = {k: [t for t, _ in sorted(v, key=lambda x: x[1])][:3] for k, v in src.items()}
json.dump(out, open('/home/user/serverless-game/addons/item-sources.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('final', len(out), out.get('Ручьевая форель'), out.get('Рунный кои'))
