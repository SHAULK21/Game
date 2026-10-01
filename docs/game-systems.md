# Рынок, уведомления, арена и кланы

## Что доступно игроку

- Рынок: выбор любой свободной вещи из инвентаря, включая руду, материалы, зелья и серверное снаряжение. Надетые, запертые и привязанные к клану вещи защищены. Серверный предмет переносится в лот атомарно, с сохранением характеристик и заточки. Повтор после потери ответа использует тот же ID операции. Продажа полного стака удаляет его из инвентаря.
- Оповещения: «Ещё → Оповещения». Отдельные переключатели энергии, арены, экспедиции, рынка, клана, PvP, Premium и рефералов. Лента доступна внутри игры; сообщения в Telegram отправляются только после включения и запуска бота. Настройки хранятся на сервере. Очередь переживает перезапуск сервиса; ошибки доставки повторяются с задержкой.
- Билеты гладиаторов: в 00:00 UTC запас доводится до пяти, дополнительные билеты сохраняются. Проверка выполняется при загрузке, возвращении в окно и периодически. Шанс билета с босса — 25%, максимум три за UTC-сутки.
- PvP: «Арена → PvP — игроки». Игрок добровольно включает участие, выбирает класс персонажа и защитную тактику. Асинхронные дуэли рассчитывает сервер; участие не требует одновременного присутствия. Рейтинг, журнал, попытки и результаты хранятся на сервере. Уровень и снаряжение уравнены, расхода зелий и HP персонажа нет. Пять отдельных попыток в UTC-сутки, минута между нападениями, один бой пары за 24 часа, разница рейтинга до 400. Соклановцы не подбираются. Рейтинг Elo с коэффициентом 24 меняется у обоих. Третий ход активирует классовый приём, после 30 раундов сравнивается доля оставшегося HP.
- Клан: глава, офицер, казначей, ветеран, участник, новичок. Глава назначает роли, передаёт руководство, улучшает клан. Офицер управляет младшими ролями и набором. Казначей, офицер и глава выдают и обрабатывают общий склад. Остальные могут вносить вещи и участвовать в рейдах. Изменения записываются в журнал. Один рейдовый удар на игрока за UTC-сутки. Победа даёт 500 XP и 250 золота казны; каждые 1000 XP открывают развитие клана. Платное улучшение стоит 1000 × текущий уровень золота казны и добавляет два места. Пределы: 15 уровень, 50 участников.
- Администратор: выдача себе игрового Premium на 1–365 дней. Проверяется серверный Telegram ID; повтор операции не продлевает срок дважды.
- Рефералы: новый друг запускает бота по личной ссылке; после достижения 10 уровня оба получают три дня **игрового** Premium. Уже активный срок продлевается. За одного друга награда выдаётся один раз; собственная ссылка и старые аккаунты не подходят.
- Premium: массовая продажа и разбор находятся внизу инвентаря. Для остальных игроков прежнее место показывает предложение подключения.

## Баланс

Только новые поступления уменьшены, имеющиеся накопления сохраняются.

- Боевой множитель золота: 0.55 → 0.22; серебра: 0.65 → 0.20.
- Награды и сундуки подземелий дают меньше валюты.
- Обычные бои больше не гарантируют несколько предметов. Боссы сохраняют гарантированные трофеи.
- Количество ресурсов в стаках дропа, цена новых трофеев и выход серебра/руды при разборе снижены.
- Ручная добыча: около 45% прежнего выхода, минимум один ресурс, крит даёт ещё один. Редкие материалы находят вдвое реже.
- Экспедиции: меньше роллов и базового количества ресурсов. Исправлена цена единицы ресурса, которая раньше зависела от размера стака.
- Энергия: +1 за 120 секунд с учётом офлайна; алхимия: +1 за 20 секунд вместо пяти.

## Запуск на сервере

`npm install`, `npm run build`, `npm run start`. `server/schema.sql` применяется автоматически при запуске; миграции повторяемые.

Для Telegram нужны `TELEGRAM_BOT_TOKEN`, `PUBLIC_BASE_URL` (или `RENDER_EXTERNAL_URL`) и доступный webhook. Сервер сам регистрирует webhook с секретом. Для админки — `ADMIN_TELEGRAM_ID`, для прежних локальных административных действий также `VITE_ADMIN_TELEGRAM_ID` при сборке. Пользователь должен запустить бота и включить уведомления. Очередь обрабатывается раз в 30 секунд; спящий сервер обработает её после пробуждения.

## Stars: текущая граница

Реальные ставки и выплаты Telegram Stars **не включены**, счета за PvP не создаются. Bot API `refundStarPayment` возвращает исходный платёж его плательщику, а подарки `sendGift` нельзя конвертировать в Stars. Для денежных соревнований нужны отдельный поддерживаемый способ выплат и проверка применимых правил.

В нынешнем проекте обычный кошелёк, уровни, добыча и PvE по-прежнему хранятся в локальном сохранении. Новый PvP не доверяет переданному клиентом урону или результату, но это не превращает весь проект в серверную игру. Перед денежными призами необходима серверная проверка прогресса и экономика. Бои Premium за настоящие Stars не заявлены как работающая возможность.

Источники: https://core.telegram.org/bots/api#refundstarpayment, https://core.telegram.org/bots/api#sendgift.

## Проверки

`npm run test`, `npm run lint`, `npm run build`. Помимо тестов интерфейса, проверяется применение схемы дважды и работа рынка, PvP, ролей клана и рефералов в PostgreSQL через PGlite. Это проверка локальной тестовой БД, а не производственного Render/PostgreSQL или реальной доставки Telegram.

## Оповещения администрации

Админка → «Оповещения по шаблону»: выбрать один из десяти шаблонов, аудиторию и открыть предпросмотр. Дополнение необязательно. Нажатие «Отправить оповещение» добавляет объявление в ленту игроков и в очередь Telegram для разрешивших сообщения. Аудитории: все, Premium, без Premium, активные за семь дней. Шаблон приглашения друга подставляет личную ссылку каждого получателя. Повтор после сбоя использует тот же ID, без второй рассылки. История показывает количество записей в игре и поставленных в очередь Telegram; это не подтверждение фактической доставки. Настройки игроков сохраняются, принудительное включение Telegram-уведомлений не выполняется.

### Paid clan creation and market names

Clan creation costs 100,000 gold, or 50,000 with active Premium. The server determines the discount from `premium_until` and stores an idempotent creation receipt. The client reserves the price in the existing local character wallet before sending the request, refunds confirmed rolled-back failures, and resumes an unresolved operation with its original UUID after reopening. Existing clans are unaffected. As elsewhere in this project, local wallet snapshots are not an authoritative server economy; this change does not migrate all gold earnings/spending to PostgreSQL.

Market listing responses expose the trimmed `character_name` as seller `display_name`. Missing names use `Игрок`; Telegram names and usernames are not included in market listing responses.

### Manual mining and pickaxes

Manual ore, bonus materials and gemstones use a weighted 1–5 yield. A critical result is exactly 5; noncritical results are 1–4. For shallow resources the noncritical weights are 60/27/10/3%; deeper nodes shift toward 1. Overall critical chance is capped at 2.5%, below the probability of a four-unit yield even with the strongest tool. Luck and the mining achievement contribute small bounded bonuses.

Five pickaxes are sold in the mine, unlocked at mining levels 1/10/25/50/80 for 250/2,000/10,000/40,000/150,000 gold. Their critical bonuses are +0.15/+0.3/+0.6/+0.9/+1.2 percentage points, and mining XP bonuses are +10/+20/+35/+55/+80%. They occupy a dedicated `pickaxe` slot and have no combat stats. Bonuses apply to manual mining; expedition rewards retain their own rules. Tools can be equipped/removed in the mine or inventory; they do not replace weapons and cannot be sharpened.

### Leaving a clan

Every member, including the owner, can use the visible leave button. The UI requires confirmation. A departing owner transfers leadership to an officer, then quartermaster, veteran, member or recruit, using seniority as the tie breaker. If no members remain, the server requires explicit disband confirmation before deleting the clan, treasury and clan-held storage. Personal items remain personal. Clan creation gold is not refunded.

### Ascension: independent character progression

The default arena tab is now Ascension; training gladiators and PvP remain separate tabs. Existing characters start at E. The sequence is E → D → C → B → A → S → SS → SSS. No stage has a character-level requirement or resets character level, XP, attributes, talent points, purchased talents, equipment or existing skill coefficients. The rank is shown separately in the character profile.

Each stage has a fixed rank guardian, one arena ticket per attempt, no XP/gold/rating/item payouts, and a persisted victory flag. Guardians cannot be farmed again after their trial is cleared. After victory, the player pays silver and ascension fragments and explicitly confirms Ascend. Failures or missing resources spend nothing. Fragments have a 40% chance to drop, one at a time, from ordinary world/dungeon bosses; trials and training arenas do not produce them. Fragments can be traded on the market; locked/clan/server-held resources are not consumed by the existing local-save ascension economy.

Stages cost respectively 500/1,500/4,000/10,000/25,000/60,000/150,000 silver and 3/8/16/30/50/85/140 fragments. Guardians have fixed HP, power and defense in `src/data/ascension.ts`; no scaling against the player's current level is applied. Mechanics include delayed heavy attacks, alternating armor, healing that can be delayed by crowd control, alternating damage types, vulnerability and two/three-phase damage escalation. Starting a trial turns autobattle off.

D chooses one of three class-named passives: +3% damage against poisoned/burning/bleeding/vulnerable targets, +2% max-HP healing when defending, or 8% of spent skill mana returned. B strengthens the primary passive by 1.5×. A chooses a different second passive. C adds one class-specific skill; S adds a second ascension skill. SS shortens the first new skill's cooldown and enables +2% damage and +2% max-HP recovery when using ascension skills with two selected passives. SSS improves only the new S skill by 15% and reduces its cooldown. New skills are unlocked by rank, not by level; existing level-based skill tiers continue to work as before.

Ascension is stored in the existing local character save, as are combat and talents. This feature does not migrate those systems to an authoritative server character store or add cross-device save synchronization. Migration and level-based skill reconciliation preserve acquired ascension skills.

After SSS, three weekly Echo challenges reuse the final guardian: Storm adds 30% HP and 20% power, Self-control forbids potions, and Eternity increases the guardian's healing to 8% HP. Each grants 3,000 silver and one monthly season victory on its first clear of the UTC week (Monday reset). Clearing all three grants a persistent cosmetic monthly title. Duplicate clears cannot pay twice. Neither titles nor seasonal scores add combat stats. Ascension skills/passives apply to the existing PvE engine; equalized server PvP retains its own class/stance rules.


## Оптимизация загрузки и обновлений

- Разделы мира, арены, инвентаря, ремесла, шахты, кланов, чата, рынка, питомцев, рейтинга, меню и персонажа загружаются при первом открытии через React.lazy. Бой и создание персонажа доступны в начальной загрузке. Админка загружается только при открытии; во время загрузки раздела виден индикатор, нижняя навигация остаётся доступной.
- Начальный JavaScript в проверенной production-сборке: примерно 536 КБ вместо 730 КБ (−27%, включая общий файл зависимостей). Это размер файлов, а не измерение FPS или времени запуска на устройстве. Суммарный код всех разделов не исчезает: дополнительные файлы скачиваются по мере использования.
- Профиль синхронизируется одним запросом вместо двух при входе и изменении уровня. Проверка приглашённого друга выполняется после синхронизации уровня; успешная проверка повторяется при следующем уровне или повторном открытии приложения.
- Расчёт боевых характеристик зависит от атрибутов, уровня, класса, экипировки, талантов, питомца, энергии, достижений и благословения. Изменения валюты, инвентаря, билетов и перезарядок не запускают расчёт заново.
- Чат не запускает параллельный опрос, пока предыдущий не завершён. Автоматические запросы приостанавливаются в скрытом окне и возобновляются сразу при возвращении. Ручное обновление сохраняется.
- Автосохранение, расчёты наград и экономика не изменены. Следующий резерв: уменьшение крупных иллюстраций и разделение общего игрового контекста по частоте обновления; это требует отдельной проверки качества изображений и всех игровых переходов.


## Алхимия: прогресс и реторты

- В лаборатории видны уровень алхимии, опыт внутри текущего уровня (220 EXP), шкала прогресса и следующий рецепт. На 100 уровне шкала показывает максимум. У каждого рецепта показан опыт за успешную варку с учётом инструмента.
- Реторта занимает отдельный слот `alchemyTool`; покупать, экипировать и снимать её можно в лаборатории, а также управлять ею в инвентаре. Без неё алхимия работает с прежними значениями. Инструменты не дают боевых характеристик и не затачиваются.
- Обычная / необычная / редкая / эпическая / легендарная реторта доступны с 1 / 10 / 25 / 50 / 80 уровня алхимии. Цены: 250 / 2000 / 10000 / 40000 / 150000 золота. Опыт: +10 / 20 / 35 / 55 / 80%, с округлением результата до целого. Шанс дополнительного зелья: 1 / 2 / 3 / 4 / 5%. Выпадает максимум одно дополнительное зелье за варку, затраты ингредиентов и энергии остаются теми же. Бонус действует только при достаточном уровне профессии.
- Варка выполняется при нажатии, задержка 600 мс служит индикатором и защитой от повторного нажатия. При нехватке ресурсов, энергии или места в сумке опыт и результат не начисляются. Посторонние предметы без stackCount сохраняются при расходовании ингредиентов.

## Карточка награды серии

Между противниками награды видны только в пошаговом журнале. После последней победы появляется итоговая карточка с суммой золота, серебра и опыта за все бои, а также предметами серии. Деньги и опыт по-прежнему начисляются после каждого противника; итоговая карточка не начисляет их второй раз. Кнопка продолжения называется «Следующий противник».
