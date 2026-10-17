const sharedFields = ['player', 'quests', 'achievements', 'activeDungeonRun'] as const;
type SharedField = typeof sharedFields[number];
export interface WireGameReply {status: number; body: any; projection?: {version: 1; root: SharedField[]; progress: SharedField[]}}
function compactEnvelope(value: any): {value: any; keys: SharedField[]} {
  if (!value?.canonical || !value.save || !value.game) return {value, keys: []};
  const keys = sharedFields.filter(key => Object.hasOwn(value.game, key) && value.game[key] !== undefined && value.game[key] === value.save[key]);
  if (!keys.length) return {value, keys};
  const game = {...value.game}; for (const key of keys) delete game[key];
  return {value: {...value, game}, keys};
}
/** Explicitly negotiated wire format: canonical save/view share these values.
 * Older clients keep receiving the complete response without this encoding. */
export function compactGameReply(reply: WireGameReply): WireGameReply {
  const root = compactEnvelope(reply.body), progress = compactEnvelope(reply.body?._progress);
  if (!root.keys.length && !progress.keys.length) return reply;
  return {...reply, body: progress.keys.length ? {...root.value, _progress: progress.value} : root.value,
    projection: {version: 1, root: root.keys, progress: progress.keys}};
}
export function expandGameReply(reply: WireGameReply): WireGameReply {
  if (reply.projection?.version !== 1) return reply;
  const expand = (value: any, keys: SharedField[]) => {
    if (!value?.canonical || !value.save || !value.game || !Array.isArray(keys)) return value;
    const game = {...value.game};
    for (const key of keys) if (sharedFields.includes(key) && !Object.hasOwn(game, key) && Object.hasOwn(value.save, key)) game[key] = value.save[key];
    return {...value, game};
  };
  const body = expand(reply.body, reply.projection.root);
  return {...reply, body: reply.projection.progress?.length ? {...body, _progress: expand(body._progress, reply.projection.progress)} : body};
}
