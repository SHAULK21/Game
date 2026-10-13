/** Prepare an owned fixture through the normal save/load path, without replacing provider logic. */
export async function fixturePlace(w:any,place:'field'|'settlement'|'dungeon') {
 const key='aethelgard_save_v1_data_'+(w.game?.player?.userId||w.Telegram?.WebApp?.initDataUnsafe?.user?.id||749219401);
 const saved=JSON.parse(w.localStorage.getItem(key));saved.player.worldPlace=place;saved.player.worldJourney=undefined;
 await w.act(async()=>w.root.unmount());w.localStorage.setItem(key,JSON.stringify(saved));await w.act(async()=>w.mount());
}
/** Finish the real durable timer without making the suite wait for wall-clock travel. */
export async function completeJourney(w:any) {
 const journey=w.game.player.worldJourney;if(!journey)return;
 const now=w.Date.now;w.Date.now=()=>journey.arrivesAt+1;
 await w.act(async()=>new Promise(resolve=>setTimeout(resolve,190)));w.Date.now=now;
}
