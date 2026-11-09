import json
P = []
F = 'index-Bqyd-ipJ.js'
# 1. Admin quick grants: client was built without VITE_ADMIN_TELEGRAM_ID, so the check was compiled to ()=>false.
P.append(dict(name='admin-grants', file=F, old='qi=()=>!1,Ji=', new='qi=()=>String(C().id)===`437290420`,Ji='))
# 2. Ascension fragments: count server-owned stacks too (locked / clan-bound still excluded).
P.append(dict(name='asc-count', file=F,
  old='var kr=e=>e.inventory.filter(e=>e.templateId===`ascension_fragment`&&!e.isLocked&&!e.boundToClan&&!e.serverOwned)',
  new='var kr=e=>e.inventory.filter(e=>e.templateId===`ascension_fragment`&&!e.isLocked&&!e.boundToClan)'))
# 3. Ascend: claim server-owned fragment stacks into the local bag (server dispose, worth 0) before spending.
old = ('_a=(0,s.useCallback)(e=>{if(!n)return{success:!1,message:`Персонаж не создан.`};if(k&&!A||F||R.isTraveling)return{success:!1,message:`Завершите текущий бой, поход или путешествие.`};'
       'let t=Ar(n,e);return t.success&&i(t=>t&&Ar(t,e).player),{success:t.success,message:t.message}},[n,k,A,F,R.isTraveling])')
new = ('_a=(0,s.useCallback)(async e=>{if(!n)return{success:!1,message:`Персонаж не создан.`};if(k&&!A||F||R.isTraveling)return{success:!1,message:`Завершите текущий бой, поход или путешествие.`};'
       'let c=n,l=Cr(c.ascension||xr()),g=``;'
       'if(l&&c.silver>=l.silver&&kr(c)>=l.fragments){'
       'let u=c.inventory.filter(t=>t.templateId===`ascension_fragment`&&!t.isLocked&&!t.boundToClan),d=u.filter(t=>!t.serverOwned).reduce((t,r)=>t+(r.stackCount||1),0),m=[];'
       'for(let t of u){if(d>=l.fragments)break;if(!t.serverOwned)continue;let r=ne();'
       'try{await fe(`/api/items/`+encodeURIComponent(t.id)+`/dispose`,{method:`POST`,body:JSON.stringify({action:`disassemble`})});'
       'm.push({...t,id:`asc_claim_`+t.id,serverOwned:!1,isEquipped:!1,slot:void 0});d+=t.stackCount||1}'
       'catch(p){g=p instanceof Error?p.message.replace(/ \\(HTTP \\d+\\)$/,``):`Не удалось списать осколки.`;break}finally{r()}}'
       'if(m.length){let t=new Set(m.map(r=>r.id.slice(10))),r=p=>({...p,inventory:[...p.inventory.filter(h=>!t.has(h.id)),...m]});c=r(c);i(p=>p&&r(p))}}'
       'if(g)return{success:!1,message:g};'
       'let t=Ar(c,e);return t.success&&i(t=>t&&Ar(t,e).player),{success:t.success,message:t.message}},[n,k,A,F,R.isTraveling])')
P.append(dict(name='asc-claim', file=F, old=old, new=new))
json.dump(P, open('frontend-patches.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(P), 'patches')
