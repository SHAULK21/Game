type ResourceSprite =
  | 'ore' | 'crystal' | 'dust' | 'herb' | 'flower' | 'root' | 'vial' | 'core'
  | 'thread' | 'scale' | 'hide' | 'fang' | 'meat' | 'coin' | 'gear' | 'key'
  | 'wing' | 'spark' | 'web' | 'badge';

const silhouette = (name: string, type: 'ore' | 'material'): ResourceSprite => {
  const normalized = name.toLowerCase();
  if (/пыль|пепел|слюда/.test(normalized)) return 'dust';
  if (/нить|шёлк/.test(normalized)) return 'thread';
  if (/паутин/.test(normalized)) return 'web';
  if (/чешу|хитин|зубец|брони/.test(normalized)) return 'scale';
  if (/шкур/.test(normalized)) return 'hide';
  if (/клык/.test(normalized)) return 'fang';
  if (/мясо/.test(normalized)) return 'meat';
  if (/монет/.test(normalized)) return 'coin';
  if (/механизм|пряжк/.test(normalized)) return 'gear';
  if (/ключ/.test(normalized)) return 'key';
  if (/крыл|перепон/.test(normalized)) return 'wing';
  if (/цветок/.test(normalized)) return 'flower';
  if (/корень/.test(normalized)) return 'root';
  if (/трава/.test(normalized)) return 'herb';
  if (/вода|эссенц|железа|кровь/.test(normalized)) return 'vial';
  if (/серд|ядро|сердцевин|тотем/.test(normalized)) return 'core';
  if (/искра/.test(normalized)) return 'spark';
  if (/знак|печат/.test(normalized)) return 'badge';
  if (/кристалл|кварц|самоцвет|алмаз|призма|слеза|осколок/.test(normalized)) return 'crystal';
  return type === 'ore' ? 'ore' : 'crystal';
};

/** Resolve a named resource to a hand-painted raster sprite from the shared icon library. */
export const getResourceArtwork = (name: string, type: 'ore' | 'material'): string =>
  `/assets/sprites/generated/ui/resources/${silhouette(name, type)}.webp`;
