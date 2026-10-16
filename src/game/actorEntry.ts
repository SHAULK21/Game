// Server bundle entry: the same gameplay rules as the browser, with environment
// effects supplied by an account-scoped actor. No DOM renderer is involved.
export {useGameEngine} from '../context/GameContext';
export {CLASSES, REGIONS, REGION_MODIFIERS, MONSTERS, CAVES, PETS_LIST, ARENA_BOTS, INITIAL_QUESTS, INITIAL_ACHIEVEMENTS, MINING_NODES, ALCHEMY_RECIPES, BASIC_CRAFT_RECIPES} from '../data/gameData';
export {getRegionMonster} from '../data/gameData';
