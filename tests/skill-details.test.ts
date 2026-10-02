import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: `export {skillDetails} from './src/utils/skillDetails';export {CLASSES} from './src/data/gameData';export {CLASS_SKILLS,HIDDEN_SKILLS} from './src/data/classEvolution';export {ascensionSkills,initialAscension} from './src/data/ascension';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'art',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default "art"',loader:'js'}));}}]});
const { skillDetails, CLASSES, CLASS_SKILLS, HIDDEN_SKILLS, ascensionSkills, initialAscension }: typeof import('../src/utils/skillDetails') & typeof import('../src/data/gameData') & typeof import('../src/data/classEvolution') & typeof import('../src/data/ascension') = await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));

const find = (id: string) => [...Object.values(CLASSES).flatMap(c=>c.startingSkills), ...Object.values(CLASS_SKILLS).flat()].find(s=>s.id===id)!;
test('skill descriptions distinguish total multi-hit damage, drain healing and support; combos name the setup skill', () => {
  const dance = skillDetails(find('r_dance')).join('\n');
  assert.match(dance, /Удары: 3.*Общий множитель делится/);
  assert.match(dance, /попадание и крит проверяются отдельно/);
  const drain = skillDetails(find('n_drain')).join('\n');
  assert.match(drain, /Лечение: 50% фактически нанесённого урона/);
  assert.match(drain, /после «Проклятие»/);
  const healing = skillDetails(find('p_heal')).join('\n');
  assert.match(healing, /Базовое лечение: 100 HP/);
  assert.match(healing, /паладина дополнительно \+15%/);
  assert.doesNotMatch(healing, /Базовый урон/);
  const burst = skillDetails(find('r_burst')).join('\n');
  assert.match(burst, /22 процентных пункта/);
  assert.match(burst, /Без яда бонуса нет/);
  const execute = skillDetails(find('n_touch')).join('\n');
  assert.match(execute, /не выше 30%.*×2/);
  assert.match(execute, /Не действует на боссов и вне пещеры/);
});

test('all base, advanced, hidden and ascension skills have complete localized descriptions from current data', () => {
  for (const c of Object.values(CLASSES)) {
    const skills = [...c.startingSkills, ...CLASS_SKILLS[c.id], HIDDEN_SKILLS[c.id],
      ...ascensionSkills(c.id, {...initialAscension(),rank:'SSS'})];
    for (const s of skills) {
      const before = JSON.stringify(s);
      const ru = skillDetails(s).join('\n');
      const uk = skillDetails(s,'uk').join('\n');
      assert.match(ru, new RegExp(`Мана: ${s.manaCost} MP`));
      assert.match(ru, new RegExp(`Перезарядка: ${s.cooldown} ходов`));
      assert.match(uk, /Рівень:/); assert.match(uk, /Перезарядка:/);
      assert.doesNotMatch(uk, /\{\d+\}|Базовый|Удары:|Связка:|Получаемый|Длительность|На цель/);
      assert.equal(JSON.stringify(s), before, 'describing a skill must not mutate gameplay data');
    }
  }
  const knight = ascensionSkills('knight',{...initialAscension(),rank:'C'})[0];
  assert.match(skillDetails(knight).join('\n'), /большее из 150 урона и 6%/);
  const paladin = ascensionSkills('paladin',{...initialAscension(),rank:'SSS'})[1];
  assert.match(skillDetails(paladin).join('\n'), /Перезарядка: 6/);
  assert.match(skillDetails(paladin).join('\n'), /Базовое лечение: большее из 345 HP/);
});
