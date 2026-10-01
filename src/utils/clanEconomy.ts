export const CLAN_CREATION_GOLD = 100000;
export const PREMIUM_CLAN_CREATION_GOLD = 50000;
export const clanCreationCost = (premium: boolean) => premium ? PREMIUM_CLAN_CREATION_GOLD : CLAN_CREATION_GOLD;
