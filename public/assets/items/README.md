# Aethelgard item art

Item artwork is resolved from the shared generated WebP sprite catalog in `../sprites/generated/ui/`.

- Equipment uses `gear/` sprites selected by item type.
- Ores and materials use `resources/` sprites selected from the item name.
- Combat and navigation symbols use `icons/` sprites.

`src/utils/itemArtwork.ts` intentionally resolves saved items through this catalog, so old image URLs do not bring back mismatched art styles. Generated asset manifests live beside their sprite sets.
