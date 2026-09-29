#!/usr/bin/env python3
"""
Split the four Canva Aethelgard item sprite sheets into individual WebP files.

Expected source files (export from Canva at original size):
  canva_item_sheets/equipment-sheet.jpg  # 6x6
  canva_item_sheets/unique-sheet.jpg     # 6x6
  canva_item_sheets/resources-sheet.jpg  # 5x5
  canva_item_sheets/potions-sheet.jpg    # 4x4

Output:
  public/assets/items/*.webp

Run:
  python scripts/split_item_icon_sheets.py
"""
from pathlib import Path
import re
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "canva_item_sheets"
OUTPUT = ROOT / "public" / "assets" / "items"

TRANSLIT = str.maketrans({
    "а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"yo","ж":"zh","з":"z","и":"i","й":"y",
    "к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"f",
    "х":"h","ц":"c","ч":"ch","ш":"sh","щ":"sch","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya"
})

def slug(name: str) -> str:
    value = name.lower().translate(TRANSLIT)
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    return value

SHEETS = {
    "equipment-sheet.jpg": (6, [
        "Клинок охотника","Сабля странника","Боевой топор","Костяной меч","Рунический жезл","Щит дозорного",
        "Рунический фокус","Баклер наёмника","Капюшон следопыта","Шлем стража","Маска охотника","Кожаный панцирь",
        "Кольчуга странника","Роба заклинателя","Поножи дозорного","Штаны охотника","Рунические поножи","Перчатки следопыта",
        "Боевые рукавицы","Чародейские перчатки","Сапоги разведчика","Ботфорты стража","Шаги тени","Амулет охотника",
        "Талисман искр","Оберег древних","Кольцо удачи","Печатка воина","Руническое кольцо","Пояс наёмника",
        "Ремень мастера","Пояс клыков","Плащ тумана","Накидка охотника","Плащ странника","Руническое ядро"
    ]),
    "unique-sheet.jpg": (6, [
        "Меч рекрута","Кованый щит","Кольчужная рубаха","Двуручная секира ярости","Меч рыцаря ордена","Пара кинжалов теней",
        "Кинжал ликвидатора","Ильмовый лук следопыта","Посох стихийного ученика","Мантия адепта","Костяной жезл могильщика","Священный боевой молот",
        "Дубовый посох хранителя","Кожаный жилет охотника","Ржавый кинжал","Стальной тесак","Пояс из шкуры вепря","Кожаные сапоги ловкача",
        "Паутинные наручи","Булава сокрушителя камней","Клинок Черной Вдовы","Шлем из хитина Матки","Меч Ледяной Скорби","Латный доспех Рыцаря Смерти",
        "Корона Инферно","Адская коса погибели","Крушитель Богов Аэтельгарда","Чешуйчатый доспех дракона","Кольцо эхолокации","Крылья Королевы Мышей",
        "Сердце монолита","Глаз Прадракона","Алмазный самородок","Волчья шкура","Острый клык","Мясо вепря"
    ]),
    "resources-sheet.jpg": (5, [
        "Уголь","Медная руда","Железная руда","Серебряная руда","Золотая руда",
        "Мифриловая руда","Адамантит","Драконит","Лечебная трава","Чистая вода",
        "Горный корень","Лунная пыльца","Сырой самоцвет","Магическая эссенция","Ядовитая железа",
        "Огненный цветок","Медная монета гоблинов","Волчья шкура","Острый клык","Мясо вепря",
        "Алмазный самородок","Глаз Прадракона","Сердце монолита","Крылья Королевы Мышей","Паутинный шёлк"
    ]),
    "potions-sheet.jpg": (4, [
        "Малое зелье исцеления","Малое зелье маны","Великое зелье исцеления","Эликсир берсерка",
        "Эликсир каменной кожи","Кровь прадракона","Сытный паёк из вепря","Перчатки следопыта",
        "Сапоги охотника","Переплавленные монеты гоблинов","Эликсир жизненной силы","Противоядие",
        "Зелье сопротивления огню","Зелье сопротивления холоду","Шахтёрский тоник","Алхимический катализатор"
    ])
}

def split_sheet(path: Path, grid: int, names: list[str]) -> None:
    img = Image.open(path).convert("RGB")
    w, h = img.size
    cell_w, cell_h = w / grid, h / grid
    OUTPUT.mkdir(parents=True, exist_ok=True)

    for index, name in enumerate(names):
        row, col = divmod(index, grid)
        left = round(col * cell_w)
        top = round(row * cell_h)
        right = round((col + 1) * cell_w)
        bottom = round((row + 1) * cell_h)
        tile = img.crop((left, top, right, bottom))
        side = min(tile.size)
        x = (tile.width - side) // 2
        y = (tile.height - side) // 2
        tile = tile.crop((x, y, x + side, y + side))
        tile = tile.resize((256, 256), Image.Resampling.LANCZOS)
        tile.save(OUTPUT / f"{slug(name)}.webp", "WEBP", quality=88, method=6)

def main() -> None:
    missing = [name for name in SHEETS if not (SOURCE / name).exists()]
    if missing:
        raise SystemExit(
            "Missing Canva exports:\n  " + "\n  ".join(str(SOURCE / name) for name in missing)
        )

    for filename, (grid, names) in SHEETS.items():
        split_sheet(SOURCE / filename, grid, names)

    print(f"Created item icons in {OUTPUT}")

if __name__ == "__main__":
    main()
