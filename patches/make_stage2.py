import json, re
A='/home/user/serverless-game/dist/assets/'
P=[]
def rep(file, old, new, name, count=1):
    s=open(A+file,encoding='utf-8').read()
    assert s.count(old)==count, (name, file, s.count(old))
    P.append(dict(name=name,file=file,old=old,new=new,count=count))
IDX='index-Bqyd-ipJ-p1.js'
# 12. remove fantasy-beta: map stored beta to fantasy
rep(IDX,'u=e=>e===`modern`||e===`fantasy`||e===`fantasy-beta`,d=()=>{try{let e=localStorage.getItem(l);return u(e)?e:`modern`}catch{return`modern`}}',
        'u=e=>e===`modern`||e===`fantasy`,d=()=>{try{let e=localStorage.getItem(l);return e===`fantasy-beta`?`fantasy`:u(e)?e:`modern`}catch{return`modern`}}','beta-off')
rep('GameScreens-CX80KEtT-p1.js',',{id:`fantasy-beta`,label:`Фэнтези — бета`,description:`Новый бестиарий и досье охотника. Бета-версия`,Icon:k}','','beta-option')
# 4. pets: lower mining requirements and ingredient availability
LV={40:15,60:25,85:35,95:45}
for f in [IDX,'PetsScreen-Bq2HU9SJ-p1.js','PetsScreen-rJgVU5ak-p1.js']:
    s=open(A+f,encoding='utf-8').read()
    m=re.search(r'\{pet_dragon:\{miningLevelReq:85.*?pet_voidling:\{miningLevelReq:95',s)
    assert m,f
    old=m.group(0); new=re.sub(r'miningLevelReq:(\d+)',lambda x:'miningLevelReq:%d'%LV[int(x.group(1))],old)
    P.append(dict(name='pets-'+f,file=f,old=old,new=new))
s=open(A+IDX,encoding='utf-8').read()
for n in ['Мифриловая руда','Арканная пыль','Магическая эссенция','Адамантит','Руническое ядро','Драконит','Осколок драконьей чешуи','Эфириум','Эфирная пыль']:
    m=re.search(r'\{[^{}]{0,120}name:`'+n+r'`[^{}]{0,120}minLevel:(\d+)[^{}]*\}',s)
    assert m,n
    old=m.group(0); new=old.replace('minLevel:%s'%m.group(1),'minLevel:%d'%LV[int(m.group(1))])
    assert s.count(old)==1,n
    P.append(dict(name='ore-'+n,file=IDX,old=old,new=new))
# TZ 2.2 polling
rep(IDX,'window.setInterval(()=>{document.visibilityState===`visible`&&r()},15e3)','window.setInterval(()=>{document.visibilityState===`visible`&&r()},6e4)','poll-state')
rep(IDX,'r=window.setInterval(()=>{document.visibilityState===`visible`&&(y(),_())},2e4)','r=window.setInterval(()=>{document.visibilityState===`visible`&&(y(),_())},12e4)','poll-telemetry')
rep(IDX,'if(!n)return;zn();let e=()=>void zn(),t=setInterval(e,6e4)','if(!n)return;zn();let q=Date.now(),e=()=>{let t=Date.now();t-q>3e5&&(q=t,zn())},t=setInterval(e,3e5)','poll-premium')
for f in ['AdminModal-zN0d84kg-p1.js','MoreMenuScreen-CQw16isG-p1.js','MoreMenuScreen-ElEmOrHE-p1.js']:
    s=open(A+f,encoding='utf-8').read(); c=s.count('o(`/api/admin/status`)')
    rep(f,'o(`/api/admin/status`)','(window.__aethAdminStatus??=o(`/api/admin/status`).catch(e=>{window.__aethAdminStatus=void 0;throw e}))','admin-status-cache-'+f,c)
# TZ 5: collapse admin statistics
rep('AdminModal-zN0d84kg-p1.js','(0,x.jsx)(D,{}),(0,x.jsx)(S,{}),',
 '(0,x.jsxs)(`details`,{className:`admin-fold`,children:[(0,x.jsx)(`summary`,{children:`📊 Новички, воронка и возвращаемость`}),(0,x.jsx)(D,{})]}),(0,x.jsxs)(`details`,{className:`admin-fold`,children:[(0,x.jsx)(`summary`,{children:`⚔️ Баланс боёв и сессии`}),(0,x.jsx)(S,{})]}),','admin-fold')
# TZ 1.7 texts
for f in ['MarketScreen-BiFw35iA-p1.js','MarketScreen-C0ZN3xJc-p1.js']:
    c=open(A+f,encoding='utf-8').read().count('через отдельный серверный кошелёк рынка: стартовые 120 золота и доход от продаж.')
    rep(f,'через отдельный серверный кошелёк рынка: стартовые 120 золота и доход от продаж.','через отдельный серверный кошелёк рынка, который пополняется доходом от продаж.','market-text-'+f,c)
for f in ['CraftingScreen-CJkQKcCJ-p1.js','CraftingScreen-YXJHXHap-p1.js']:
    s=open(A+f,encoding='utf-8').read(); c=s.count(' · Возможна заточка +1–+5')
    if c: rep(f,' · Возможна заточка +1–+5',' · Заточка: от +1 до +5','sharpen-text-'+f,c)
rep(IDX,'Aa={success:!1,message:ge};return(0,c.jsx)(Ri.Provider,{value:{',
 'Aa={success:!1,message:ge};window.__aethBridge={player:n,setPlayer:i,api:fe,busy:ne,sound:U,canAct:K,gainExp:Se};return(0,c.jsx)(Ri.Provider,{value:{','addon-bridge')
CSS='''
/* stage2: compact navigation during combat (all interfaces) */
html[data-in-combat] .modern-reference-nav .reference-nav-items{height:46px!important}
html[data-in-combat] .modern-reference-nav .game-nav-item{font-size:0!important;gap:0!important}
html[data-in-combat] .modern-reference-nav .reference-icon{width:22px!important;height:22px!important}
html[data-in-combat] .fantasy-shell-nav .shell-nav-grid{height:50px!important}
html[data-in-combat] .fantasy-shell-nav .game-nav-item{font-size:0!important;gap:0!important}
html[data-in-combat] .fantasy-shell-nav .game-nav-item>*{transform:scale(.72);transform-origin:center}
html[data-in-combat]{--reference-nav-height:48px}
/* TZ 1.1: content and chat composer stay above the bottom navigation */
.modern-shell>main{padding-bottom:calc(var(--reference-nav-height,72px) + env(safe-area-inset-bottom,0px) + 16px)!important}
.chat-composer{position:sticky;bottom:calc(var(--reference-nav-height,72px) + env(safe-area-inset-bottom,0px));z-index:5;background:#10151b;padding-bottom:8px}
/* TZ 1.2: hero stat icons cropped from reference art must not show its printed labels */
.codex-stat .hero-stat-icon{width:22px!important;min-width:22px!important;height:22px!important;overflow:hidden!important;flex:0 0 22px!important}
.codex-stat .hero-stat-icon svg{width:22px!important;height:22px!important}
/* TZ 5: collapsible admin statistics */
.admin-fold{border:1px solid #33415580;border-radius:12px;padding:6px 10px}
.admin-fold>summary{cursor:pointer;font-size:12px;font-weight:700;color:#e2e8f0;padding:6px 0;list-style:none}
.admin-fold>summary::-webkit-details-marker{display:none}
.admin-fold>summary::after{content:" ▾";color:#94a3b8}
.admin-fold[open]>summary::after{content:" ▴"}
'''
P.append(dict(name='stage2-css',file='index-CScHp4Ho-p1.css',append=CSS))
json.dump(P,open('stage2-patches.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(P),'patches')
