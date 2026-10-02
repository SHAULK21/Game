import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { ITEM_SPRITES, getItemSpritePath, getResourceSprite } from '../src/utils/itemSprites';
import { getItemArtworkPath } from '../src/utils/itemArtwork';
import { getResourceArtwork, getResourceVectorArtwork } from '../src/utils/resourceArtwork';

test('sprite families cover gear and potions without changing item names or explicit art', async () => {
  assert.match(getItemSpritePath({name:'Редкий меч рекрута',type:'weapon'})!, /sword.webp$/);
  assert.match(getItemSpritePath({name:'Пара кинжалов теней',type:'weapon'})!, /dagger.webp$/);
  assert.match(getItemSpritePath({name:'Ильмовый лук следопыта',type:'weapon'})!, /bow.webp$/);
  assert.match(getItemSpritePath({name:'Посох ученика',type:'weapon'})!, /staff.webp$/);
  assert.match(getItemSpritePath({name:'Настой маны · ур. 5',type:'potion'})!, /mana-potion.webp$/);
  assert.match(getItemSpritePath({name:'Малое зелье исцеления',type:'potion'})!, /health-potion.webp$/);
  assert.equal(getItemArtworkPath({name:'Меч',type:'weapon',image:'/custom.webp'}),'/custom.webp');
  for (const name of Object.values(ITEM_SPRITES)) {
    const bytes=await fs.readFile(`public/assets/items/sprites/${name}.webp`);
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.ok(bytes.length<100_000, `${name}: oversized inventory icon`);
  }
});

test('resources use local sprites and retain vector fallback for uncovered materials', () => {
  assert.match(getResourceArtwork('Медная руда','ore'),/copper-ore.webp$/);
  assert.match(getResourceArtwork('Железная руда','ore'),/iron-ore.webp$/);
  assert.match(getResourceArtwork('Золотая руда','ore'),/gold-ore.webp$/);
  assert.match(getResourceSprite('Волчья шкура')!,/hide.webp$/);
  assert.match(getResourceSprite('Знак элиты · plains')!,/seal.webp$/);
  assert.match(getResourceVectorArtwork('Железная руда','ore'),/^data:image\/svg\+xml,/);
  assert.match(getResourceArtwork('Эфирная пыль','material'),/^data:image\/svg\+xml,/);
});
