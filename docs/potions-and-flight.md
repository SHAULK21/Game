# Turn potion limits and flight penalty

Every interface shares these provider rules:

- One potion total per player turn. A second potion, including a different kind or strength, is rejected without consumption. Useful HP/MP potions still preserve the action; throws and pure buff potions retain their previous turn costs. The allowance resets after the enemy turn and for a new enemy in a chain. A synchronous ref blocks repeated and stale clicks; visible state disables unavailable potion buttons.
- Alchemy cannot craft while a combat is unresolved. The provider guard also blocks a craft in the same event that starts combat, before a render. Both alchemy screens explain the restriction and disable recipe actions. Resources, energy and experience stay unchanged on a blocked craft.
- Autobattle filters unavailable potions and proceeds to its next action instead of repeatedly trying to heal. It stops after fleeing and pauses for the unread first-flight warning.
- Successful flee or forced exit from an unresolved combat applies **Позор беглеца / Ганьба втікача** for three subsequent completed enemy battles: physical/magic attack and physical/magic defense ×0.90. HP, mana, permanent attributes and equipment do not change. A failed flee attempt does not apply it. Leaving victory/defeat results does not refresh it.
- Both victory and defeat consume one penalized battle, including individual enemies in a series. Another flight refreshes the counter to three; it does not stack the percentage. The counter and warning acknowledgement are saved with the character. Unread warnings survive reload.
- The first flight opens a localized illustrated story using the existing royal-order artwork. Later flights do not repeat the story. The hunt/battle page displays the remaining count, including the current battle when active.

Checks: TypeScript, production build and 176 tests, including provider tests for repeated/different potion requests, round reset, direct crafting during combat, same-event crafting, failed/successful flee, direct exit, reload, three victories, defeat and post-result cleanup. Russian/Ukrainian UI tests verify the first-flight story and image before onboarding continues. Existing ordinary ascension stats retain memo identity when there is no penalty.
