import { t as localize, useLocale } from '../../../../i18n/locale';
import React, { useState } from 'react';
import { Check, Flame, HeartPulse, LockKeyhole, PawPrint, Shield, Sparkles } from 'lucide-react';
import { PETS_LIST } from '../../data/gameData';
import { useGame } from '../../../../context/GameContext';
import { BestiaryPanel, FolioPage, RpgButton } from '../ui/BestiaryUI';
import { PetArtwork } from '../ui/PetArtwork';
import { ItemArtwork } from '../ui/ItemArtwork';

const PET_RECIPES: Record<string, { miningLevelReq: number; ingredients: Array<{ name: string; count: number }> }> = {
  pet_dragon: {
    miningLevelReq: 85,
    ingredients: [
      { name: 'Драконит', count: 12 },
      { name: 'Осколок драконьей чешуи', count: 8 },
      { name: 'Драконья искра', count: 2 }
    ]
  },
  pet_fairy: {
    miningLevelReq: 40,
    ingredients: [
      { name: 'Мифриловая руда', count: 10 },
      { name: 'Арканная пыль', count: 8 },
      { name: 'Магическая эссенция', count: 4 }
    ]
  },
  pet_golem: {
    miningLevelReq: 60,
    ingredients: [
      { name: 'Адамантит', count: 10 },
      { name: 'Руническое ядро', count: 4 },
      { name: 'Осколок титана', count: 8 }
    ]
  },
  pet_voidling: {
    miningLevelReq: 95,
    ingredients: [
      { name: 'Эфириум', count: 10 },
      { name: 'Эфирная пыль', count: 12 },
      { name: 'Звёздное ядро', count: 3 }
    ]
  }
};

export const PetsScreen: React.FC = () => {
  useLocale();
  const { player, setActivePet, craftPet } = useGame();
  const [feedback,setFeedback]=useState<string|null>(null);
  if (!player) return null;
  const activeId=player.activePet?.id;
  const owned=new Set(player.craftedPetIds || ['pet_wolf']);
  const activePet=PETS_LIST.find(p=>p.id===activeId);
  const others=PETS_LIST.filter(p=>p.id!==activeId);
  const card=(pet: typeof PETS_LIST[number])=>{
    const active=pet.id===activeId;
    const isOwned=owned.has(pet.id);
    const recipe=PET_RECIPES[pet.id];
    const levelReady=!recipe || player.miningLevel>=recipe.miningLevelReq;
    const SkillIcon=({pet_wolf:PawPrint,pet_dragon:Flame,pet_fairy:HeartPulse,pet_golem:Shield,pet_voidling:Sparkles})[pet.id] || Sparkles;
    return <BestiaryPanel key={pet.id} className={`codex-paper pet-codex-card ${active?'is-active':''}`}>
      <PetArtwork id={pet.id} label={localize(pet.name)}/>
      <div className="pet-codex-info">
        <div className="pet-codex-name"><h2>{localize(pet.name)}</h2><span className={`pet-rarity is-${pet.rarity}`}>{localize(({rare:'Редкий',epic:'Эпический',mythic:'Мифический'} as Record<string,string>)[pet.rarity] || pet.rarity)}</span></div>
        <p className="pet-codex-bonus">{localize(pet.passiveBonus)}</p>
        <div className={`pet-codex-skill is-${pet.id}`}><span className="pet-skill-emblem"><SkillIcon aria-hidden="true"/></span><div><h3>{localize(pet.activeSkillName)}</h3><p>{localize(pet.activeSkillDesc)}</p></div></div>
        {!isOwned&&recipe&&<div className="pet-codex-recipe">
          <p className={levelReady?'is-ready':'is-locked'}><LockKeyhole size={13} aria-hidden="true"/>{localize('Требуется горное дело ')}{recipe.miningLevelReq}{localize(' ур.')}</p>
          <div className="pet-codex-ingredients">{recipe.ingredients.map(ingredient=>{
            const have=player.inventory.reduce((sum,item)=>sum+(item.name===ingredient.name?(item.stackCount||1):0),0);
            return <div key={ingredient.name} className={`pet-ingredient ${have>=ingredient.count?'is-ready':'is-missing'}`}>
              <ItemArtwork item={{name:ingredient.name,type:'material',rarity:'rare',icon:'✦'}} size={28}/>
              <div><span>{localize(ingredient.name)}</span><strong>{have}/{ingredient.count}</strong></div>
            </div>;
          })}</div>
        </div>}
        {isOwned?<RpgButton variant={active?'primary':'secondary'} className={`pet-codex-action ${active?'is-active':''}`} onClick={async ()=>{
          const ok=await setActivePet(pet.id);setFeedback(ok?`${pet.name} выбран.`:'Не удалось выбрать питомца.');
        }}>{active&&<Check size={20} aria-hidden="true"/>}{localize(active?'Активен':'Выбрать питомца')}</RpgButton>:
          <RpgButton icon="forge" variant="primary" className="pet-codex-action" disabled={!levelReady} onClick={async ()=>setFeedback((await craftPet(pet.id)).message)}>{localize('Создать питомца')}</RpgButton>}
      </div>
    </BestiaryPanel>;
  };
  return <FolioPage className="pet-codex space-y-3 pt-3">
    <header className="pet-codex-heading"><PawPrint aria-hidden="true"/><h1>{localize('Питомцы')}</h1><PawPrint aria-hidden="true"/></header>
    <p className="pet-codex-intro">{localize('Верные спутники помогают в приключениях и дают уникальные бонусы. Создавайте новых из редких ресурсов высоких уровней шахты.')}</p>
    <p className="pet-codex-mining">{localize('Горное дело: ')}{player.miningLevel}{localize(' ур.')}</p>
    {feedback&&<div role="status" className="pet-codex-feedback">{localize(feedback)}</div>}
    {activePet&&card(activePet)}
    <div className="pet-codex-divider"><span>{localize(activePet?'Другие питомцы':'Все питомцы')}</span><small title={localize('Созданные питомцы')}><PawPrint size={14} aria-hidden="true"/>{owned.size}/{PETS_LIST.length}</small></div>
    <div className="pet-codex-list">{others.map(card)}</div>
    <p className="pet-codex-intro">{localize('Снежный лютоволк доступен сразу. Остальные питомцы требуют редких руд и материалов из шахты.')}</p>
  </FolioPage>;
};
