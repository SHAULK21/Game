import { FISH } from './fishing';
import { getResourceSprite } from './itemSprites';
// Local vector artwork stays available offline and scales to inventory/detail sizes.
// Names choose a silhouette; resource families use distinct mineral/magic palettes.
const shapes = {
  ore: '<path d="m14 43 7-23 21-8 17 16 3 20-24 8z" fill="url(#body)"/><path d="m21 20 17 14 4-22M38 34l21-6M38 34v22M14 43l24-9 24 14" fill="none" stroke="#ffffff" stroke-opacity=".3"/><path d="m26 25 6-3 4 7-6 5zm18 14 7-5 5 8-8 4z" fill="COLOR"/>',
  crystal: '<path d="m21 44 4-23 9-12 12 17-2 24-12 6z" fill="url(#body)"/><path d="m34 9-1 31-8-19m8 19 13-14M33 40l-1 16" fill="none" stroke="#ffffff" stroke-opacity=".55"/><path d="m43 47 6-19 8 9-3 16-10 2z" fill="COLOR" opacity=".75"/>',
  dust: '<path d="m12 48 12-9 14-5 17 12-3 6H17z" fill="url(#body)"/><path d="m20 46 13-5 13 7" fill="none" stroke="COLOR"/><g fill="COLOR"><circle cx="22" cy="25" r="2"/><circle cx="40" cy="18" r="3"/><circle cx="47" cy="30" r="2"/><circle cx="31" cy="31" r="1.5"/><path d="m31 12 2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></g>',
  herb: '<path d="M31 54q3-18 6-38" stroke="COLOR" stroke-width="3" fill="none"/><path d="M34 39Q9 37 12 17q20 0 22 22M37 29q-1-23 20-19 0 18-20 19M32 49Q12 48 16 33q16 0 16 16" fill="url(#body)"/><path d="m17 23 17 16m17-22-14 12m-16 9 11 11" stroke="#fff" stroke-opacity=".35"/>',
  flower: '<path d="M33 54V27m0 18q-17-1-17-12 14 0 17 12m0-5q15-2 15-12-13 0-15 12" fill="none" stroke="#4d9c63" stroke-width="3"/><g fill="url(#body)"><ellipse cx="33" cy="16" rx="7" ry="12"/><ellipse cx="23" cy="24" rx="11" ry="7" transform="rotate(25 23 24)"/><ellipse cx="43" cy="24" rx="11" ry="7" transform="rotate(-25 43 24)"/><ellipse cx="28" cy="32" rx="7" ry="10"/><ellipse cx="40" cy="32" rx="7" ry="10"/></g><circle cx="33" cy="25" r="6" fill="#ffe5a1"/>',
  root: '<path d="m35 15-3 16-10 13 4 9 11-18 6 14 5 4-5-21 3-13" fill="url(#body)"/><path d="m35 15-7-7m12 10 9-9" stroke="#83b676" stroke-width="3"/><path d="m29 39 7 1m-3-11 9 2" stroke="#fff" stroke-opacity=".4"/>',
  vial: '<path d="M26 10h14v6h-2v10q14 8 12 20-2 10-17 10T16 46q-2-12 12-20V16h-2z" fill="#143042" stroke="#99d4dc" stroke-width="2"/><path d="M19 37q14 5 28 0l1 9q-2 7-15 7t-15-7z" fill="url(#body)"/><path d="M25 30q-6 8-5 14" stroke="#fff" stroke-opacity=".65" stroke-width="2" fill="none"/><path d="M26 9h14" stroke="#b58a56" stroke-width="5"/><circle cx="35" cy="44" r="3" fill="COLOR"/>',
  core: '<path d="m33 9 19 11 3 23-22 14-22-14 3-23z" fill="url(#body)"/><circle cx="33" cy="33" r="11" fill="#122036" stroke="COLOR" stroke-width="3"/><path d="m33 24 5 9-5 9-5-9zm-15-3 3 6m24-6-3 6m-22 18 6-3m19 3-6-3" fill="none" stroke="#fff" stroke-opacity=".7"/>',
  thread: '<path d="m20 13 25 1-3 7-2 25 4 7-25-1 4-7 1-25z" fill="#986b48"/><path d="m21 23 22 2m-23 4 23 2m-23 4 22 2m-22 4 22 2" stroke="COLOR" stroke-width="4"/><path d="M43 33q16 3 9 16t-8 9" fill="none" stroke="COLOR" stroke-width="2"/>',
  scale: '<path d="m33 9 21 16-3 19-18 13-18-13-3-19z" fill="url(#body)"/><path d="m33 9 1 34-19 1m19-1 17 1M20 23l14 20 12-20m-12 20-1 14" fill="none" stroke="#fff" stroke-opacity=".4"/>',
  hide: '<path d="m16 10 13 8 10-1 10-7 7 13-11 8 7 19-14-3-6 10-8-9-14 2 9-20-10-7z" fill="url(#body)"/><path d="m23 22 7 5m12-5-8 11m-13 9 9-7m11 4 3 5" stroke="#251c21" stroke-width="3"/><path d="m17 24 5 4m-4 15 5-2m17 4 6 2" stroke="#fff" stroke-opacity=".4"/>',
  fang: '<path d="M19 13q15-9 28 1-3 30-29 43 13-19 10-30z" fill="url(#body)"/><path d="M21 15q15-5 23 0M32 26q-1 13-9 24" stroke="#fff" stroke-opacity=".6" fill="none"/>',
  meat: '<path d="M19 21q9-14 21-7t14 22q-1 18-23 19T12 39q-2-10 7-18" fill="url(#body)"/><path d="M22 24q7-9 16-4t10 17q-2 12-16 12T19 38q-2-7 3-14" fill="none" stroke="#fac3b3" stroke-width="3"/><ellipse cx="32" cy="34" rx="6" ry="9" fill="#ffe8d3"/>',
  coin: '<ellipse cx="32" cy="34" rx="21" ry="22" fill="url(#body)" stroke="COLOR" stroke-width="3"/><ellipse cx="32" cy="34" rx="15" ry="16" fill="none" stroke="#fff" stroke-opacity=".4"/><path d="m32 22 7 12-7 12-7-12z" fill="none" stroke="COLOR" stroke-width="3"/>',
  gear: '<path d="m26 10 14 1 1 7 6 3 7-2 5 12-6 5-1 6 4 6-10 9-6-4-7 1-4 5-12-7 2-7-3-6-6-2 3-14 7 1 5-4z" fill="url(#body)"/><circle cx="33" cy="34" r="10" fill="#101b2c" stroke="COLOR" stroke-width="3"/><circle cx="33" cy="34" r="4" fill="COLOR"/>',
  key: '<circle cx="26" cy="22" r="11" fill="none" stroke="COLOR" stroke-width="6"/><path d="m33 31 18 20m-5-5 6-5m-12-1 6-5" fill="none" stroke="COLOR" stroke-width="5"/>',
  wing: '<path d="M32 53Q9 49 8 14l25 19 23-19Q56 47 32 53" fill="url(#body)"/><path d="m8 14 15 31 10-12-1 20m24-39-14 31-9-12" fill="none" stroke="#fff" stroke-opacity=".4"/>',
  spark: '<path d="M34 7q-2 16 10 21 9-9 7-12 16 28-5 38-21 10-31-9-8-15 4-27-2 13 6 15 5-11 9-26" fill="url(#body)"/><path d="M34 31q1 9 7 13 2 10-8 10t-8-10z" fill="#fff1b3"/>',
  web: '<path d="M33 9v47M10 20l45 25M11 45l43-25M14 14l38 38M14 52l38-38M10 33h46" stroke="COLOR" fill="none"/><path d="m23 23 10-5 10 5 5 10-5 10-10 5-10-5-5-10zm5 5 5-3 5 3 3 5-3 5-5 3-5-3-3-5z" stroke="COLOR" fill="none" stroke-width="2"/>',
  badge: '<path d="m33 9 20 9-3 26-17 13-17-13-3-26z" fill="url(#body)"/><path d="m33 20 4 9 10 1-8 7 2 11-8-6-9 6 2-11-8-7 11-1z" fill="COLOR" stroke="#fff" stroke-opacity=".3"/>'
};

type Shape = keyof typeof shapes;
const cache = new Map<string, string>();
const palette = (name: string) => {
  if (/кров|демон|дракон|огнен|пепель/.test(name)) return ['#ed7468', '#6d233d'];
  if (/золот|янтар|монет|пирит|песчан/.test(name)) return ['#ffd67a', '#986029'];
  if (/медн|корень|шкур|мясо/.test(name)) return ['#d7a277', '#75432f'];
  if (/эфир|вечност|звёзд|небес|прокля|бездн/.test(name)) return ['#d2b5ff', '#663caa'];
  if (/кобальт|синяя|мифрил|магичес|аркан|лунн/.test(name)) return ['#a8eaff', '#316da4'];
  if (/трав|ядов|болот|лесн|цветок/.test(name)) return ['#b7ed92', '#32785d'];
  if (/серебр|желез|соль|солян|кварц|алмаз|титан/.test(name)) return ['#e0f1f5', '#6c8b9d'];
  return ['#bcbed7', '#535a7a'];
};

const silhouette = (name: string, type: string): Shape => {
  if (/пыль|пепел|слюда/.test(name)) return 'dust';
  if (/нить|шёлк/.test(name)) return 'thread';
  if (/паутин/.test(name)) return 'web';
  if (/чешу|хитин|зубец|брони/.test(name)) return 'scale';
  if (/шкур/.test(name)) return 'hide';
  if (/клык/.test(name)) return 'fang';
  if (/мясо/.test(name)) return 'meat';
  if (/монет/.test(name)) return 'coin';
  if (/механизм|пряжк/.test(name)) return 'gear';
  if (/ключ/.test(name)) return 'key';
  if (/крыл|перепон/.test(name)) return 'wing';
  if (/цветок/.test(name)) return 'flower';
  if (/корень/.test(name)) return 'root';
  if (/трава/.test(name)) return 'herb';
  if (/вода|эссенц|железа|кровь/.test(name)) return 'vial';
  if (/серд|ядро|сердцевин|тотем/.test(name)) return 'core';
  if (/искра/.test(name)) return 'spark';
  if (/знак|печат/.test(name)) return 'badge';
  if (/кристалл|кварц|самоцвет|алмаз|призма|слеза|осколок/.test(name)) return 'crystal';
  return type === 'ore' ? 'ore' : 'crystal';
};

export const getResourceVectorArtwork = (name: string, type: 'ore' | 'material'): string => {
  const key = `${type}:${name}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const normalized = name.toLowerCase();
  const [light, dark] = palette(normalized);
  const drawing = shapes[silhouette(normalized, type)].replace(/COLOR/g, light);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 66 66"><defs><linearGradient id="body" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient><radialGradient id="halo"><stop stop-color="${dark}" stop-opacity=".5"/><stop offset="1" stop-color="${dark}" stop-opacity="0"/></radialGradient></defs><circle cx="33" cy="34" r="32" fill="url(#halo)"/><g stroke-linejoin="round" stroke-linecap="round">${drawing}</g></svg>`;
  const src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  cache.set(key, src);
  return src;
};

export const getResourceArtwork = (name: string, type: 'ore' | 'material'): string =>
  (FISH.find(f=>f.name===name) ? '/assets/fishing/'+FISH.find(f=>f.name===name)!.id+'.webp' : getResourceSprite(name)) || getResourceVectorArtwork(name, type);
