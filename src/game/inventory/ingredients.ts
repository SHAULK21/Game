import type { GameItem } from '../../types/game';

export const countIngredient = (inventory: GameItem[], name: string) =>
  inventory.reduce((sum, item) => sum + (item.name === name ? (item.stackCount ?? 1) : 0), 0);

export const consumeIngredients = (
  inventory: GameItem[],
  ingredients: Array<{ name: string; count: number }>
): GameItem[] => {
  let next = inventory.map(item => ({ ...item }));
  for (const ingredient of ingredients) {
    let remaining = ingredient.count;
    next = next.map(item => {
      if (remaining <= 0 || item.name !== ingredient.name) return item;
      const take = Math.min(item.stackCount ?? 1, remaining);
      remaining -= take;
      return { ...item, stackCount: (item.stackCount ?? 1) - take };
    }).filter(item => (item.stackCount ?? 1) > 0);
  }
  return next;
};
