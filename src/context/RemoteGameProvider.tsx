import { beginGameOperation, hasGameOperation } from "../utils/gameOperations";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { GameContextType } from "./GameContext";
import { apiRequest, GameApiError } from "../utils/api";
import { installCloudTransport } from "../utils/cloudTransport";
import {
  gameSaveKey,
  readAccountSave,
  readResetVersion,
} from "../utils/accountReset";
import { getTelegramUser, getTelegramWebApp } from "../utils/telegram";
import { createOperationId } from "../utils/operationId";
import { t, useLocale } from "../i18n/locale";
import { sound } from "../utils/audio";
import { triggerHaptic } from "../utils/telegram";
import { StartupReady } from "../components/layout/StartupReady";

type Envelope = {
  protocol: 1;
  serverTime: number;
  telegramId: string;
  resetVersion: number;
  version: number;
  sessionGeneration: number;
  activeSession: boolean;
  ownsSession: boolean;
  migrationAllowed: boolean;
  state: Omit<GameContextType, never>;
  result?: any;
  events?: Array<{ type: string; name?: string; args: any[] }>;
};
const actions = [
  "createCharacter",
  "acknowledgeFirstJourney",
  "advanceRoyalBriefing",
  "setAdventureStoryStep",
  "finishAdventureStory",
  "dismissAdventureStory",
  "dismissFlightWarning",
  "allocateAttribute",
  "unlockTalent",
  "resetTalentTree",
  "equipItem",
  "unequipItem",
  "sellItem",
  "sellToResidents",
  "disassembleItem",
  "bulkDisposeItems",
  "toggleItemLock",
  "refreshServerInventory",
  "expandInventory",
  "upgradeItem",
  "meditateOrRefillEnergy",
  "claimRegionCompletion",
  "setActiveRegionMod",
  "setActivePet",
  "craftPet",
  "startBattleWithMonster",
  "startNextCombatBattle",
  "performPlayerAction",
  "toggleAutoBattle",
  "updateAutoBattleSettings",
  "exitCombat",
  "setCurrentRegion",
  "startTravel",
  "enterDungeon",
  "proceedDungeonRoom",
  "exitDungeon",
  "buyAlchemyTool",
  "buyPickaxe",
  "mineNode",
  "startMiningExpedition",
  "claimMiningExpedition",
  "leaveMiningExpedition",
  "craftAlchemy",
  "fishingAction",
  "listMarketItem",
  "refreshMarketIncome",
  "returnMarketListing",
  "buyMarketListing",
  "buyBasicConsumable",
  "craftBasicItem",
  "refreshPremiumStatus",
  "preparePremiumInvoice",
  "createClan",
  "challengeAscension",
  "ascend",
  "challengeArena",
  "claimQuestReward",
  "claimAchievementReward",
  "sendChatMessage",
  "dismissOfflineReport",
  "adminAddGold",
  "adminAddSilver",
  "adminLevelUp",
  "adminSpawnLegendaryItem",
  "adminHealAll",
];
const resultActions = new Set([
  "createCharacter",
  "finishAdventureStory",
  "equipItem",
  "unequipItem",
  "sellToResidents",
  "bulkDisposeItems",
  "expandInventory",
  "upgradeItem",
  "setActivePet",
  "craftPet",
  "startBattleWithMonster",
  "startNextCombatBattle",
  "startTravel",
  "proceedDungeonRoom",
  "buyAlchemyTool",
  "buyPickaxe",
  "mineNode",
  "startMiningExpedition",
  "claimMiningExpedition",
  "leaveMiningExpedition",
  "craftAlchemy",
  "fishingAction",
  "listMarketItem",
  "returnMarketListing",
  "buyMarketListing",
  "buyBasicConsumable",
  "craftBasicItem",
  "preparePremiumInvoice",
  "challengeAscension",
  "ascend",
  "challengeArena",
]);
export function RemoteGameProvider({
  children,
  context: Context,
}: {
  children: React.ReactNode;
  context: React.Context<GameContextType | undefined>;
}) {
  useLocale();
  const userId = String(getTelegramUser().id);
  const current = useRef<Envelope | null>(null),
    busy = useRef(false),
    pending = useRef<any>(null),
    session = useRef(""),
    alive = useRef(true);
  const [envelope, setEnvelope] = useState<Envelope | null>(null),
    [status, setStatusState] = useState("loading"),
    [message, setMessage] = useState(""),
    [legacy, setLegacy] = useState<any>(null),
    [choice, setChoice] = useState(false);
  const statusRef = useRef("loading");
  const setStatus = useCallback((next: string) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);
  const pendingKey = "aethelgard_cloud_pending_" + userId;
  const accept = useCallback(
    (next: Envelope) => {
      if (!alive.current) return next;
      if (
        next.protocol !== 1 ||
        next.telegramId !== userId ||
        next.resetVersion !== readResetVersion(userId) ||
        (next.state.player && String(next.state.player.userId) !== userId)
      )
        throw new Error(
          "Сервер вернул данные другого аккаунта или версии сброса.",
        );
      const previous = current.current;
      if (
        previous &&
        (next.version < previous.version ||
          next.sessionGeneration < previous.sessionGeneration ||
          (next.version === previous.version &&
            next.sessionGeneration === previous.sessionGeneration &&
            next.serverTime < previous.serverTime))
      )
        return previous;
      current.current = next;
      setEnvelope(next);
      // Only confirmed server responses enter the device cache.
      try {
        localStorage.setItem(
          gameSaveKey(userId),
          JSON.stringify({
            resetVersion: next.resetVersion,
            player: next.state.player,
            quests: next.state.quests,
            achievements: next.state.achievements,
            activeDungeonRun: next.state.activeDungeonRun,
            cloud: { version: next.version, state: next.state },
          }),
        );
      } catch {
        /* Cache is optional; server confirmation is sufficient. */
      }
      return next;
    },
    [userId],
  );
  const load = useCallback(async () => {
    const next = await apiRequest<Envelope>("/api/game", {
      headers: { "X-Game-Session": session.current },
      signal: AbortSignal.timeout(15000),
    });
    return accept(next);
  }, [accept]);
  const sendPending = useCallback(async () => {
    if (!pending.current) return;
    busy.current = true;
    const migrating = pending.current.migrate;
    setStatus("saving");
    try {
      const received = await apiRequest<Envelope>(
        pending.current.migrate ? "/api/game/migrate" : "/api/game/commands",
        {
          method: "POST",
          body: JSON.stringify(pending.current.body),
          signal: AbortSignal.timeout(20000),
        },
      );
      const next = accept(received);
      for (const event of received.events || []) {
        if (
          event.type === "sound" &&
          event.name?.startsWith("play") &&
          typeof (sound as any)[event.name] === "function"
        )
          (sound as any)[event.name](...event.args);
        else if (event.type === "haptic") triggerHaptic(event.args[0]);
      }
      pending.current = null;
      try {
        localStorage.removeItem(pendingKey);
      } catch {}
      if (migrating) {
        setChoice(false);
        setLegacy(null);
        try {
          localStorage.removeItem("aethelgard_legacy_candidate_" + userId);
        } catch {}
      }
      setStatus(next.ownsSession ? "ready" : "readonly");
      setMessage("");
      return received.result;
    } catch (error) {
      const conflict =
        error instanceof GameApiError &&
        [
          "VERSION_CONFLICT",
          "SESSION_REVOKED",
          "ACCOUNT_RESET",
          "OPERATION_CONFLICT",
        ].includes(error.code || "");
      if (conflict) {
        pending.current = null;
        localStorage.removeItem(pendingKey);
        try {
          await load();
        } catch {}
        setStatus("conflict");
        setMessage(error.message);
      } else if (
        error instanceof GameApiError &&
        error.status &&
        error.status < 500
      ) {
        pending.current = null;
        try {
          localStorage.removeItem(pendingKey);
        } catch {}
        setStatus(error.status === 401 ? "offline" : "ready");
        setMessage(error.message);
      } else {
        setStatus("offline");
        setMessage(
          "Нет подтверждения сервера. Действия остановлены. Повторите запрос после восстановления сети.",
        );
      }
      throw error;
    } finally {
      busy.current = false;
    }
  }, [accept, load, pendingKey]);
  const command = useCallback(
    async (name: string, args: any[]) => {
      const snapshot = current.current;
      if (
        busy.current ||
        pending.current ||
        !snapshot?.ownsSession ||
        statusRef.current !== "ready"
      )
        throw new Error(
          "Дождитесь подтверждения сервера или перенесите активную сессию.",
        );
      const body = {
        operationId: createOperationId(),
        sessionId: session.current,
        sessionGeneration: snapshot.sessionGeneration,
        expectedVersion: snapshot.version,
        command: name,
        args,
      };
      // Record the exact operation before sending, so reload/lost response retries the same ID.
      localStorage.setItem(pendingKey, JSON.stringify({ body }));
      pending.current = { body };
      return sendPending();
    },
    [sendPending, status, pendingKey],
  );
  const claim = useCallback(
    async (takeover = false) => {
      if (!current.current) return;
      busy.current = true;
      setStatus("loading");
      try {
        const e = current.current;
        const next = await apiRequest<Envelope>("/api/game/session", {
          method: "POST",
          body: JSON.stringify({
            sessionId: session.current,
            takeover,
            expectedVersion: e.version,
            expectedGeneration: e.sessionGeneration,
          }),
        });
        accept(next);
        setStatus("ready");
        setMessage("");
      } catch (error) {
        await load().catch(() => undefined);
        setStatus("readonly");
        setMessage(String(error));
      } finally {
        busy.current = false;
      }
    },
    [accept, load],
  );
  useEffect(() => {
    alive.current = true;
    const start = async () => {
      try {
        const sessionKey = "aethelgard_cloud_session_" + userId;
        session.current =
          sessionStorage.getItem(sessionKey) || createOperationId();
        sessionStorage.setItem(sessionKey, session.current);
        let local: any = null;
        try {
          local = JSON.parse(
            localStorage.getItem("aethelgard_legacy_candidate_" + userId) ||
              readAccountSave(userId) ||
              "null",
          );
        } catch {
          /* A corrupt optional cache must never prevent the server read. */
        }
        const candidate =
          local?.player &&
          !local.cloud &&
          String(local.player.userId) === userId &&
          (local.resetVersion ?? 0) === readResetVersion(userId)
            ? local
            : null;
        if (candidate)
          localStorage.setItem(
            "aethelgard_legacy_candidate_" + userId,
            JSON.stringify(candidate),
          );
        let savedPending: any;
        try {
          savedPending = JSON.parse(localStorage.getItem(pendingKey) || "null");
        } catch {}
        const next = await load();
        if (candidate) {
          setLegacy(candidate);
          setChoice(true);
        }
        if (
          next.ownsSession &&
          savedPending?.body.sessionId === session.current &&
          savedPending.body.sessionGeneration === next.sessionGeneration
        ) {
          pending.current = savedPending;
          await sendPending().catch(() => undefined);
        } else if (!next.activeSession) await claim();
        else setStatus(next.ownsSession ? "ready" : "readonly");
      } catch (error) {
        setStatus("offline");
        setMessage(String(error));
      }
    };
    void start();
    return () => {
      alive.current = false;
    };
  }, [userId]);
  useEffect(
    () =>
      installCloudTransport((path, options) =>
        command("api", [path, { method: options.method, body: options.body }]),
      ),
    [command],
  );
  useEffect(() => {
    if (!envelope || choice) return;
    const refresh = async () => {
      if (busy.current || pending.current || document.hidden) return;
      try {
        const next = await load();
        if (!next.ownsSession) {
          setStatus("readonly");
          setMessage("Активная сессия находится на другом устройстве.");
        }
      } catch {
        setStatus("offline");
        setMessage("Нет соединения с сервером. Изменения остановлены.");
      }
    };
    const timer = window.setInterval(refresh, 5000);
    const visible = () => {
      if (!document.hidden) void refresh();
    };
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [Boolean(envelope), choice, load]);
  useEffect(() => {
    if (
      statusRef.current !== "ready" ||
      choice ||
      (!envelope?.state.isInCombat && !envelope?.state.travelState.isTraveling)
    )
      return;
    const timer = setTimeout(() => {
      if (!busy.current && !pending.current)
        void command("_tick", []).catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, [envelope, status, choice, command]);
  const player = envelope?.state.player;
  useEffect(() => {
    if (!player || !envelope?.ownsSession) return;
    const heartbeat = () => {
      if (!document.hidden)
        void apiRequest("/api/profile/heartbeat", {
          method: "POST",
          body: "{}",
        }).catch(() => undefined);
    };
    heartbeat();
    const timer = setInterval(heartbeat, 60000);
    return () => clearInterval(timer);
  }, [player?.userId, envelope?.ownsSession]);
  useEffect(() => {
    if (!player || !envelope?.ownsSession) return;
    void apiRequest("/api/referrals/check", {
      method: "POST",
      body: "{}",
    }).catch(() => undefined);
  }, [player?.userId, player?.level, envelope?.ownsSession]);
  useEffect(() => {
    if (!player || !envelope?.ownsSession) return;
    void apiRequest("/api/notifications/schedule", {
      method: "POST",
      body: JSON.stringify({
        energy: player.energy,
        maxEnergy: player.maxEnergy,
        regenAt: player.lastEnergyRegenTimestamp,
        miningEndsAt: player.miningExpedition?.endsAt,
      }),
    }).catch(() => undefined);
  }, [
    player?.userId,
    player?.energy,
    player?.lastEnergyRegenTimestamp,
    player?.miningExpedition?.endsAt,
    envelope?.ownsSession,
  ]);
  const migrate = async () => {
    if (
      !legacy ||
      !current.current?.ownsSession ||
      busy.current ||
      pending.current ||
      statusRef.current !== "ready"
    )
      return;
    const next = current.current;
    try {
      localStorage.setItem(
        "aethelgard_migration_backup_" + userId + "_" + Date.now(),
        JSON.stringify(legacy),
      );
      const body = {
        operationId: createOperationId(),
        sessionId: session.current,
        sessionGeneration: next.sessionGeneration,
        expectedVersion: next.version,
        save: legacy,
        replace: !!next.state.player,
        confirmCharacterId: legacy.player.id,
      };
      localStorage.setItem(pendingKey, JSON.stringify({ migrate: true, body }));
      pending.current = { migrate: true, body };
      await sendPending();
      setChoice(false);
      setLegacy(null);
      localStorage.removeItem("aethelgard_legacy_candidate_" + userId);
    } catch (error) {
      setMessage(String(error));
    }
  };
  const retry = async () => {
    try {
      if (pending.current) await sendPending();
      else {
        const next = await load();
        const saved = JSON.parse(localStorage.getItem(pendingKey) || "null");
        if (
          next.ownsSession &&
          saved?.body.sessionId === session.current &&
          saved.body.sessionGeneration === next.sessionGeneration
        ) {
          pending.current = saved;
          await sendPending();
        } else if (!next.activeSession) await claim();
        else setStatus(next.ownsSession ? "ready" : "readonly");
      }
    } catch (error) {
      if (!pending.current) setMessage(String(error));
    }
  };
  const guard = () => {
    if (
      busy.current ||
      pending.current ||
      hasGameOperation() ||
      statusRef.current !== "ready"
    )
      return "Дождитесь подтверждения сохранения на сервере.";
    if (
      current.current?.state.isInCombat &&
      !current.current.state.isCombatEnded
    )
      return "Нельзя сменить интерфейс во время незавершённого боя.";
    if (current.current?.state.travelState.isTraveling)
      return "Дождитесь завершения путешествия.";
    return "";
  };
  const values: any = {
    ...envelope?.state,
    resetCharacter: () => {
      void apiRequest<{ resetVersion: number }>(
        "/api/admin/players/" + userId + "/reset",
        {
          method: "POST",
          body: JSON.stringify({
            operationId: createOperationId(),
            expectedVersion: envelope?.resetVersion,
            confirmTargetId: userId,
          }),
        },
      )
        .then((result) =>
          window.dispatchEvent(
            new CustomEvent("aethelgard-account-reset", { detail: result }),
          ),
        )
        .catch((error) => setMessage(String(error)));
    },
    commitSwitchSnapshot: () => {},
    flushProgress: () => {
      if (guard()) throw new Error(guard());
    },
    getInterfaceSwitchBlockReason: guard,
  };
  for (const name of actions)
    values[name] = (...args: any[]) => {
      const task = command(name, args);
      if (resultActions.has(name))
        return task
          .then((result) => (name === "createCharacter" ? true : result))
          .catch((error) => {
            if (!pending.current) setMessage(String(error));
            return [
              "equipItem",
              "unequipItem",
              "sellToResidents",
              "bulkDisposeItems",
              "expandInventory",
              "upgradeItem",
              "craftPet",
              "startTravel",
              "buyAlchemyTool",
              "buyPickaxe",
              "mineNode",
              "startMiningExpedition",
              "claimMiningExpedition",
              "leaveMiningExpedition",
              "fishingAction",
              "listMarketItem",
              "returnMarketListing",
              "buyMarketListing",
              "craftBasicItem",
              "challengeAscension",
              "ascend",
            ].includes(name)
              ? { success: false, message: String(error) }
              : false;
          });
      return task.catch((error) => {
        if (!pending.current) setMessage(String(error));
      });
    };
  // Premium invoice is opened by Telegram on the device; status itself is server-owned.
  values.purchasePremium = async (link?: string) => {
    const invoice = link || (await values.preparePremiumInvoice());
    if (!invoice)
      return { success: false, message: "Не удалось создать счёт." };
    const tg = getTelegramWebApp();
    if (!tg?.openInvoice)
      return { success: false, message: "Откройте игру в Telegram." };
    const finishOperation = beginGameOperation();
    return new Promise((resolve) => {
      try {
        tg.openInvoice!(invoice, (result) => {
          finishOperation();
          void command("refreshPremiumStatus", []).catch(() => undefined);
          resolve({
            success: result === "paid",
            message:
              result === "paid"
                ? "Premium активирован."
                : "Оплата не завершена.",
          });
        });
      } catch (error) {
        finishOperation();
        resolve({ success: false, message: String(error) });
      }
    });
  };
  const panel = (
    <div className="fixed inset-0 z-[90] bg-slate-950 p-6 flex flex-col items-center justify-center gap-3 text-center">
      <StartupReady />
      {envelope?.state.player && (
        <p>
          {envelope.state.player.name} · {t("Уровень")}{" "}
          {envelope.state.player.level}
        </p>
      )}
      <p role="status">
        {t(
          status === "loading"
            ? "Загрузка серверного персонажа…"
            : message || "Серверное сохранение недоступно.",
        )}
      </p>
      <button
        className="min-h-11 rounded border px-4"
        onClick={() => void retry()}
      >
        {t("Повторить")}
      </button>
      {envelope?.activeSession && !envelope.ownsSession && (
        <button
          className="min-h-11 rounded border px-4"
          onClick={() => void claim(true)}
        >
          {t("Играть на этом устройстве")}
        </button>
      )}
    </div>
  );
  if (!envelope) return panel;
  if (choice)
    return (
      <div className="p-6 space-y-4 text-center">
        <StartupReady />
        <h1>{t("Выберите персонажа для переноса")}</h1>
        <p>
          {t(
            "Прогресс разных устройств не объединяется. Перед заменой сохраняется резервная копия.",
          )}
        </p>
        <p>
          {legacy.activeDungeonRun && !legacy.activeDungeonRun.completed && (
            <span>
              {t(
                "Незавершённый локальный поход будет закрыт без наград и возврата энергии, со штрафом отступления.",
              )}{" "}
            </span>
          )}
          {t("На устройстве")}: {legacy.player.name}, {t("Уровень")}{" "}
          {legacy.player.level}
        </p>
        <p>
          {t("На сервере")}:{" "}
          {envelope.state.player
            ? `${envelope.state.player.name}, ${t("Уровень")} ${envelope.state.player.level}`
            : t("Персонаж отсутствует")}
        </p>
        {!envelope.migrationAllowed && (
          <p>
            {t(
              "Перенос старого сохранения закрыт. Серверный прогресс защищён от замены.",
            )}
          </p>
        )}
        {message && <p role="alert">{t(message)}</p>}
        <button
          disabled={
            !envelope.ownsSession ||
            busy.current ||
            pending.current !== null ||
            status !== "ready" ||
            !envelope.migrationAllowed
          }
          onClick={() => void migrate()}
          className="min-h-11 rounded border px-4"
        >
          {t("Сохранить персонажа этого устройства")}
        </button>
        {(status === "offline" || status === "conflict") && (
          <button
            className="min-h-11 rounded border px-4"
            onClick={() => void retry()}
          >
            {t("Повторить")}
          </button>
        )}
        <button
          disabled={status === "saving" || pending.current !== null}
          onClick={() => {
            setChoice(false);
            setLegacy(null);
            localStorage.removeItem("aethelgard_legacy_candidate_" + userId);
          }}
          className="min-h-11 rounded border px-4"
        >
          {t(
            envelope.state.player
              ? "Оставить серверного персонажа"
              : "Создать нового персонажа",
          )}
        </button>
        {!envelope.ownsSession && (
          <button
            onClick={() => void claim(true)}
            className="min-h-11 rounded border px-4"
          >
            {t("Играть на этом устройстве")}
          </button>
        )}
      </div>
    );
  return (
    <Context.Provider value={values}>
      <div
        aria-live="polite"
        className="fixed inset-x-3 top-1 z-[80] rounded bg-slate-950/90 text-center text-xs p-1"
      >
        {t(
          status === "ready"
            ? "Прогресс сохранён на сервере"
            : status === "saving"
              ? "Сохранение…"
              : message || "Изменения остановлены.",
        )}
      </div>
      {status === "offline" ||
      status === "conflict" ||
      status === "readonly" ? (
        <>
          {panel}
          <div inert>{children}</div>
        </>
      ) : (
        <>
          <div inert={status === "saving" || status === "loading"}>
            {children}
          </div>
          {message && (
            <p role="alert" className="p-3 text-center">
              {t(message)}
            </p>
          )}
        </>
      )}
    </Context.Provider>
  );
}
