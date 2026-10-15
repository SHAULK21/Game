import type {GameItem, ItemRarity} from '../../types/game';
import {residentMarketDay, residentNeutralUnitGold} from '../../utils/localMarket';
import {MINING_EXPEDITION_POOLS} from './catalog';

export const BALANCE_VERSION = 'expeditions-2026-10-15-v1';
export const HOUR = 3_600_000;
export const MAX_SKILL = 20;
export const DURATIONS = [1, 3, 7] as const;
export type Duration = typeof DURATIONS[number];
export type Goal = 'balanced' | 'ore' | 'alchemy' | 'valuable';
export type Preparation = 'none' | 'lantern' | 'provisions' | 'tool';
export type Crew = 'personal' | 'hired';
export const GOALS: readonly Goal[] = ['balanced', 'ore', 'alchemy', 'valuable'];
export const PREPARATIONS: Readonly<Record<Preparation, number>> = {none: 0, lantern: 5, provisions: 8, tool: 8};
export const ROUTES = [
  {id: 'old-mine', name: 'Старая шахта', uk: 'Стара шахта', skill: 1, mining: 1, wage: 5, success: .8},
  {id: 'deep-tunnels', name: 'Глубокие тоннели', uk: 'Глибокі тунелі', skill: 5, mining: 15, wage: 8, success: .65},
  {id: 'abandoned', name: 'Заброшенная выработка', uk: 'Покинута виробка', skill: 10, mining: 40, wage: 10, success: .5},
] as const;
export type RouteId = typeof ROUTES[number]['id'];
export const MATERIALS = MINING_EXPEDITION_POOLS;
export interface Loot {materialId: string; quantity: number}
export interface Selection {route: RouteId; goal: Goal; duration: Duration; preparation: Preparation; crew: Crew}
export interface RulesInput extends Selection {skill: number; mining: number; day: string}
export interface ExpeditionSnapshot extends RulesInput {
  balanceVersion: string;
  cost: number;
  base: Loot[];
  event: {kind: 'vein' | 'cache' | 'flood' | 'collapse'; success: boolean; bonus: Loot[]} | null;
}
export class ExpeditionRuleError extends Error {
  constructor(public code: string, message: string) {super(message);}
}
export function trainingCost(level: number) {
  if (!Number.isInteger(level) || level < 1 || level > MAX_SKILL) throw new ExpeditionRuleError('INVALID_SKILL', 'Некорректный уровень навыка.');
  return level === MAX_SKILL ? null : 500 * level * level;
}
export function skillBonuses(level: number) {
  trainingCost(level);
  return {quantity: .02 * (level - 1), valuableWeight: .01 * (level - 1)};
}
const valuable = (rarity: ItemRarity) => rarity !== 'common' && rarity !== 'uncommon';
const matches = (goal: Goal, material: typeof MATERIALS[number]) => goal === 'balanced' || (goal === 'ore' ? material.type === 'ore' : goal === 'alchemy' ? material.type === 'material' : valuable(material.rarity));
/** A stable, public rumour; outcomes still use a separate secret random seed. */
export function dailyRumour(day = residentMarketDay()) {
  const parsed = Date.parse(day + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== day) throw new ExpeditionRuleError('INVALID_DAY', 'Некорректный игровой день.');
  const n = Math.floor(Date.parse(day + 'T00:00:00Z') / 86_400_000);
  return {day, route: ROUTES[n % ROUTES.length].id, group: (n % 2 ? 'ore' : 'alchemy') as Goal, weight: 1.1};
}
export function expeditionPrice(selection: Selection) {
  const route = ROUTES.find(r => r.id === selection.route);
  if (!route || !DURATIONS.includes(selection.duration) || !GOALS.includes(selection.goal) || !Object.hasOwn(PREPARATIONS, selection.preparation) || !['personal', 'hired'].includes(selection.crew)) throw new ExpeditionRuleError('INVALID_SELECTION', 'Неизвестные параметры экспедиции.');
  return selection.duration * (PREPARATIONS[selection.preparation] + (selection.crew === 'hired' ? route.wage : 0));
}
export function validateSelection(input: RulesInput) {
  expeditionPrice(input);
  trainingCost(input.skill);
  if (!Number.isInteger(input.mining) || input.mining < 1 || input.mining > 100) throw new ExpeditionRuleError('INVALID_MINING', 'Некорректный уровень горного дела.');
  const route = ROUTES.find(r => r.id === input.route)!;
  if (input.skill < route.skill || input.mining < route.mining) throw new ExpeditionRuleError('ROUTE_LOCKED', `Требуются навык ${route.skill} и горное дело ${route.mining}.`);
  if (input.crew === 'hired' && input.skill < 5) throw new ExpeditionRuleError('CREW_LOCKED', 'Бригада доступна с уровня навыка 5.');
  if (!MATERIALS.some(m => m.minLevel <= input.mining && matches(input.goal, m))) throw new ExpeditionRuleError('GOAL_LOCKED', 'Для этой цели пока нет доступных материалов.');
  dailyRumour(input.day);
}
/** One distribution for forecast and resolution; no UI-specific multipliers. */
export function distribution(input: RulesInput) {
  validateSelection(input);
  const rumour = dailyRumour(input.day);
  const weighted = MATERIALS.filter(m => m.minLevel <= input.mining).map(material => {
    let weight = material.weight;
    // Route identity shifts emphasis without unlocking materials above mining level.
    if (input.route === 'deep-tunnels' && material.type === 'ore') weight *= 1.2;
    if (input.route === 'abandoned' && valuable(material.rarity)) weight *= 1.4;
    if (input.goal !== 'balanced' && matches(input.goal, material)) weight *= 2;
    if (material.rarity !== 'common') weight *= input.duration === 7 ? 1.8 : input.duration === 3 ? 1.25 : 1;
    if (rumour.route === input.route && matches(rumour.group, material)) weight *= rumour.weight;
    if (valuable(material.rarity)) weight *= (1 + skillBonuses(input.skill).valuableWeight) * (input.preparation === 'tool' ? 1.2 : 1);
    return {material, weight};
  });
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  return weighted.map(item => ({material: item.material, probability: item.weight / total}));
}
const rarityFactor = (rarity: ItemRarity) => ({common: 1, uncommon: .8, rare: .55, epic: .35, legendary: .2, mythic: .2, ancient: .2, divine: .2}[rarity]);
const rolls = (hours: number) => hours >= 7 ? 4 : hours >= 3 ? 3 : 2;
const quantityFactor = (input: RulesInput) => (1 + skillBonuses(input.skill).quantity) * (input.preparation === 'provisions' ? 1.1 : 1) * (input.crew === 'hired' ? .65 : 1);
function roundedExpectation(hours: number, rarity: ItemRarity, premium = 1) {
  const low = Math.max(1, Math.round(hours * premium * .45)) * rarityFactor(rarity);
  const high = low + (hours + 2) * rarityFactor(rarity);
  let expectation = 0;
  for (let count = 1; count <= Math.ceil(high); count++) {
    const left = count === 1 ? low : Math.max(low, count - .5);
    const right = Math.min(high, count + .5);
    expectation += count * Math.max(0, right - left) / (high - low);
  }
  return expectation;
}
export function preview(input: RulesInput) {
  const items = distribution(input).map(({material, probability}) => ({material, probability,
    expected: rolls(input.duration) * probability * roundedExpectation(input.duration, material.rarity) * quantityFactor(input)}));
  const route = ROUTES.find(r => r.id === input.route)!;
  const eventChance = {1: .2, 3: .4, 7: .6}[input.duration];
  const eventSuccess = Math.min(1, route.success + (input.preparation === 'lantern' ? .15 : 0));
  const baseValue = items.reduce((sum, item) => sum + item.expected * residentNeutralUnitGold(materialItem(item.material.id)), 0);
  return {items, cost: expeditionPrice(input), eventChance, eventSuccess, expectedValue: baseValue * (1 + eventChance * eventSuccess * .2), quantityBonus: skillBonuses(input.skill).quantity};
}
/** Deterministic arithmetic PRNG. Seed is minted and retained by the server only. */
export function seededRandom(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {state = (state + 0x6D2B79F5) >>> 0; let value = Math.imul(state ^ state >>> 15, 1 | state); value ^= value + Math.imul(value ^ value >>> 7, 61 | value); return ((value ^ value >>> 14) >>> 0) / 4294967296;};
}
function stochasticRound(value: number, random: () => number) {return Math.floor(value) + (random() < value % 1 ? 1 : 0);}
function mergeLoot(loot: Loot[]) {
  const result = new Map<string, number>();
  for (const item of loot) if (item.quantity > 0) result.set(item.materialId, (result.get(item.materialId) || 0) + item.quantity);
  return [...result].map(([materialId, quantity]) => ({materialId, quantity}));
}
export function resolveExpedition(input: RulesInput, seed: string): ExpeditionSnapshot {
  const weighted = distribution(input), random = seededRandom(seed), base: Loot[] = [];
  for (let roll = 0; roll < rolls(input.duration); roll++) {
    let cursor = random(), picked = weighted[weighted.length - 1].material;
    for (const item of weighted) {cursor -= item.probability; if (cursor < 0) {picked = item.material; break;}}
    const oldCount = Math.max(1, Math.round((Math.max(1, Math.round(input.duration * .45)) + random() * (input.duration + 2)) * rarityFactor(picked.rarity)));
    base.push({materialId: picked.id, quantity: stochasticRound(oldCount * quantityFactor(input), random)});
  }
  const merged = mergeLoot(base), forecast = preview(input);
  let event: ExpeditionSnapshot['event'] = null;
  if (random() < forecast.eventChance) {
    const kind = (['vein', 'cache', 'flood', 'collapse'] as const)[Math.floor(random() * 4)];
    const success = random() < forecast.eventSuccess;
    event = {kind, success, bonus: success ? mergeLoot(merged.map(item => ({...item, quantity: stochasticRound(item.quantity * .2, random)}))) : []};
  }
  return {...input, balanceVersion: BALANCE_VERSION, cost: forecast.cost, base: merged, event};
}
export function outcome(snapshot: Pick<ExpeditionSnapshot, 'base' | 'event' | 'duration' | 'crew'>, elapsedMs: number) {
  const complete = elapsedMs >= snapshot.duration * HOUR;
  const fraction = complete ? 1 : elapsedMs < 300_000 ? 0 : Math.min(.85, .85 * Math.max(0, elapsedMs) / (snapshot.duration * HOUR));
  const loot = complete ? mergeLoot([...snapshot.base, ...(snapshot.event?.bonus || [])]) : mergeLoot(snapshot.base.map(item => ({...item, quantity: Math.floor(item.quantity * fraction)})));
  const miningXp = snapshot.crew === 'hired' ? 0 : Math.floor(snapshot.duration * 25 * fraction);
  return {complete, loot, miningXp};
}
export function materialItem(id: string): GameItem {
  const material = MATERIALS.find(m => m.id === id);
  if (!material) throw new ExpeditionRuleError('UNKNOWN_MATERIAL', 'Материал отсутствует в каталоге.');
  return {id: '', templateId: 'expedition_' + material.name.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '_'), name: material.name, icon: material.icon, type: material.type, rarity: material.rarity, level: 1, upgradeLevel: 0, stats: {}, sellPrice: 2, disassembleYield: material.type === 'ore' ? {ore: 1} : {silver: 2}, description: 'Добыто в шахтёрской экспедиции.'};
}
export function dailyOrder(skill: number, mining: number, day: string) {
  const available = ROUTES.filter(route => route.skill <= skill && route.mining <= mining);
  const candidates = MATERIALS.filter(m => m.minLevel <= mining && ['common', 'uncommon'].includes(m.rarity));
  if (!available.length || !candidates.length) throw new ExpeditionRuleError('ORDER_LOCKED', 'Нет доступного заказа.');
  const random = seededRandom('resident-order:' + day), route = available[Math.floor(random() * available.length)], material = candidates[Math.floor(random() * candidates.length)];
  const forecast = preview({skill, mining, day, route: route.id, goal: material.type === 'ore' ? 'ore' : 'alchemy', duration: 3, preparation: 'none', crew: 'personal'});
  const quantity = Math.max(1, Math.floor(.5 * forecast.items.find(i => i.material.id === material.id)!.expected));
  const unitGold = residentNeutralUnitGold(materialItem(material.id));
  return {day, materialId: material.id, quantity, unitGold, rewardGold: Math.floor(unitGold * quantity * 1.25)};
}
/** Original Premium formula: no paid skill, selected goal or preparation. */
export function legacyPremiumLoot(hours: number, mining: number, seed: string): Loot[] {
  if (!Number.isFinite(hours) || hours < 1 || hours > 8) throw new ExpeditionRuleError('INVALID_DURATION', 'Некорректный интервал Premium.');
  const random = seededRandom(seed), available = MATERIALS.filter(m => m.minLevel <= mining), result: Loot[] = [];
  if (!available.length) throw new ExpeditionRuleError('INVALID_MINING', 'Некорректное горное дело.');
  const weighted = available.map(material => ({material, weight: material.weight * (material.rarity === 'common' ? 1 : hours >= 7 ? 1.8 : hours >= 3 ? 1.25 : 1)}));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  for (let roll = 0; roll < rolls(hours); roll++) {
    let cursor = random() * total, picked = weighted[weighted.length - 1].material;
    for (const item of weighted) {cursor -= item.weight; if (cursor <= 0) {picked = item.material; break;}}
    result.push({materialId: picked.id, quantity: Math.max(1, Math.round((Math.max(1, Math.round(hours * 1.15 * .45)) + random() * (hours + 2)) * rarityFactor(picked.rarity)))});
  }
  return mergeLoot(result);
}
