/** Immediate buyout; the player market keeps its own negotiated lot prices. */
export function localBuyoutGold(sellPrice: unknown, quantity: number) {
  const value = Number(sellPrice ?? 10);
  const price = Number.isFinite(value) ? Math.max(0, Math.min(100000, Math.floor(value))) : 0;
  return (price > 0 ? Math.max(1, Math.floor(price * 0.3)) : 0) * quantity;
}
