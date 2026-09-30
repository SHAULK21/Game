export const calculateMarketSale = (priceGold: number, premium: boolean) => {
  const taxGold = premium ? 0 : Math.ceil(priceGold * 3 / 100);
  return { taxGold, sellerGold: priceGold - taxGold, taxPercent: premium ? 0 : 3 };
};
