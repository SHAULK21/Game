import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

// Mount the real provider and talent component: catches integration failures that
// pure point-accounting tests cannot see. API responses are isolated from production.
test('real UI learns, resets and migrates; combat skills apply extra strikes and traps', async () => {
  const bundle = await build({
    stdin: { contents: `import React, {act} from 'react';
      import {createRoot} from 'react-dom/client';
      import {GameProvider, useGame} from './src/context/GameContext';
      import {TalentTree} from './src/components/character/TalentTree';
      function Probe(){window.game=useGame();return window.game.player ? <TalentTree/> : null;}
      window.mount=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<GameProvider><Probe/></GameProvider>);};
      window.act=act;`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife',
    define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env.VITE_ADMIN_TELEGRAM_ID': '""' },
    plugins: [{ name: 'stub-artwork', setup(b) { b.onLoad({filter:/\.(jpg|webp)$/}, () => ({contents:'export default "artwork";',loader:'js'})); } }],
  });
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost', runScripts: 'outside-only' });
  const w: any = dom.window;
  w.MessageChannel = class { port1 = { onmessage: null as null | (() => void) }; port2 = { postMessage: () => setTimeout(() => this.port1.onmessage?.(), 0) }; };
  w.IS_REACT_ACT_ENVIRONMENT = true;
  w.Headers = Headers;
  w.fetch = async () => ({ok:true,status:200,text:async()=>JSON.stringify({active:false,items:[],ok:true})});
  w.eval(bundle.outputFiles[0].text);
  try {
    await w.act(async () => w.mount());
    await w.act(async () => w.game.createCharacter('Испытатель', 'archer'));
    assert.equal(w.game.player.talents.filter((t:any)=>t.branch==='damage').length,10);
    const save = JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data'));
    save.player.level=100;save.player.talentPoints=100;save.player.silver=5000;
    await w.act(async()=>w.root.unmount());
    w.localStorage.setItem('aethelgard_save_v1_data',JSON.stringify(save));
    await w.act(async()=>w.mount());
    const button = (text:string) => [...w.document.querySelectorAll('button')].find((b:any)=>b.textContent===text) as any;
    await w.act(async()=>button('Изучить · 1 очк.').click());
    assert.equal(w.game.player.talentPoints,99);
    assert.equal(JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data')).player.talentPoints,99);
    assert.equal(w.document.querySelectorAll('article').length,10);
    await w.act(async()=>button('Сбросить распределение').click());
    await w.act(async()=>button('Сбросить за 2000 серебра').click());
    assert.equal(w.game.player.talentPoints,100);assert.equal(w.game.player.silver,3000);
    await w.act(async()=>button('Мастерство · с 101 уровня').click());
    assert.equal([...w.document.querySelectorAll('button')].filter((b:any)=>b.textContent==='Нужен уровень 101'&&b.disabled).length,4);

    // Seed purchased ranks, then use the actual combat action resolver.
    save.player.talents.find((t:any)=>t.id==='archer_damage_5').currentRank=1;
    save.player.talents.find((t:any)=>t.id==='archer_class_5').currentRank=1;
    await w.act(async()=>w.root.unmount());
    w.localStorage.setItem('aethelgard_save_v1_data',JSON.stringify(save));
    await w.act(async()=>w.mount());
    w.Math.random=()=>0; // deterministic hits/crits for the combat assertions
    const monster={id:'test_target',name:'Манекен',regionId:'arena',level:1,hp:100000,maxHp:100000,mp:0,maxMp:0,attack:1,magicAttack:0,defense:0,magicDefense:0,speed:1,critChance:0,evasion:0,avatar:'',expReward:1,goldReward:1,drops:[]};
    await w.act(async()=>w.game.startBattleWithMonster(monster,{chain:false,energyCost:0}));
    const skill=w.game.player.skills.find((s:any)=>s.damageMultiplier>0);
    await w.act(async()=>w.game.performPlayerAction('skill',skill.id));
    const strikes=w.game.battleLog.filter((entry:any)=>entry.type==='crit'||entry.type==='player-attack');
    assert.equal(strikes.length,(skill.hits||1)+1);
    assert.ok(w.game.monsterEffects.some((e:any)=>e.type==='poison'&&e.duration===2&&e.value>0));
    const points=w.game.player.talentPoints;
    await w.act(async()=>w.game.unlockTalent('archer_damage_1'));
    assert.equal(w.game.player.talentPoints,points,'talents cannot change during combat');
    await w.act(async()=>w.game.resetTalentTree());
    assert.equal(w.game.player.silver,5000,'reset cannot charge during combat');

    // Shield specialization: stronger/longer shield, then a real block follow-up.
    await w.act(async()=>w.root.unmount());
    w.localStorage.removeItem('aethelgard_save_v1_data');
    await w.act(async()=>w.mount());
    await w.act(async()=>w.game.createCharacter('Защитник','knight'));
    const knightSave=JSON.parse(w.localStorage.getItem('aethelgard_save_v1_data'));
    knightSave.player.level=100;
    for (const id of ['knight_survival_5','knight_survival_8','knight_class_5']) knightSave.player.talents.find((t:any)=>t.id===id).currentRank=1;
    await w.act(async()=>w.root.unmount());
    w.localStorage.setItem('aethelgard_save_v1_data',JSON.stringify(knightSave));
    await w.act(async()=>w.mount());
    await w.act(async()=>w.game.startBattleWithMonster({...monster,attack:10},{chain:false,energyCost:0}));
    await w.act(async()=>w.game.performPlayerAction('skill','k_bastion'));
    const shield=w.game.playerEffects.find((e:any)=>e.type==='shield');
    assert.equal(shield.value,156);assert.equal(shield.duration,5);
    for (let tick=0;tick<4 && w.game.turnPhase==='monster';tick++) await w.act(async()=>await new Promise(resolve=>setTimeout(resolve,800)));
    assert.equal(w.game.turnPhase,'player');
    await w.act(async()=>w.game.performPlayerAction('attack'));
    assert.ok(w.game.battleLog.some((entry:any)=>entry.text.includes('Сочетание талантов: +20%')));

  } finally { await w.act(async()=>w.root.unmount());dom.window.close(); }
});
