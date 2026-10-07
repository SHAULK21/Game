import { SelectionField } from '../../../../components/ui/SelectionField';
import { t as localize, useLocale, intlLocale } from '../../../../i18n/locale';
import { CLAN_PROJECTS, clanProjectCost, clanRaidReward, type ClanProject } from '../../../../utils/clanProjects';
import { createOperationId } from '../../../../utils/operationId';
import { clanCreationCost } from '../../../../utils/clanEconomy';
import {ClanManagement} from '../../../../components/clan/ClanManagement';
import {CLAN_ROLE_LABELS,canUseVault,type ClanRole} from '../../../../utils/clanRoles';
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../../../utils/api';
import { useGame } from '../../../../context/GameContext';
import { triggerHaptic } from '../../../../utils/telegram';
import { RpgIcon } from '../ui/RpgIcon';
import { BestiaryPanel, FolioPage, ProgressBar, RpgButton, SectionTitle } from '../ui/BestiaryUI';

type Clan = {
  id: string;
  tag: string;
  name: string;
  description: string;
  level: number;
  xp: number;
  max_members: number;
  members_count: number;
  treasury_gold: number;
  projects?: Partial<Record<ClanProject, number>>;
  raid_name: string;
  raid_hp: number;
  raid_max_hp: number;
  raid_reset_at: string;
  role?: ClanRole;
  recruitment_open?: boolean;
  min_join_level?: number;
};

type Member = {
  telegram_id: number;
  display_name: string;
  username?: string;
  role: ClanRole;
  raid_damage?: number;
  joined_at: string;
};

type ClanMessage = {
  id: number;
  text: string;
  created_at: string;
  display_name: string;
};

type StoredItem = {
  id: string;
  item_json: { name: string; icon: string; rarity: string; level: number };
  quantity: number;
  locked?: boolean;
  bound_clan_id?: string | null;
  equipped_slot?: string | null;
};
type StorageEvent = { action: string; item_name: string; quantity: number; display_name: string; created_at: string };

export const ClanScreen: React.FC = () => {
  useLocale();
  const { player, createClan: createPaidClan, premium, refreshServerInventory } = useGame();
  const [clan, setClan] = useState<Clan | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ClanMessage[]>([]);
  const [clans, setClans] = useState<Clan[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [chatText, setChatText] = useState('');
  const [storedItems, setStoredItems] = useState<StoredItem[]>([]);
  const [personalItems, setPersonalItems] = useState<StoredItem[]>([]);
  const [storageEvents, setStorageEvents] = useState<StorageEvent[]>([]);
  const [recipients,setRecipients] = useState<Record<string,string>>({});
  const [bulkRarity, setBulkRarity] = useState('common');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const me = await apiRequest<{ clan: Clan | null; members?: Member[]; messages?: ClanMessage[] }>('/api/clan/me');
      setClan(me.clan);
      setMembers(me.members || []);
      setMessages(me.messages || []);
      if (me.clan) {
        const storage = await apiRequest<{ stored: StoredItem[]; personal: StoredItem[]; events: StorageEvent[] }>('/api/clan/storage');
        setStoredItems(storage.stored);
        setPersonalItems(storage.personal);
        setStorageEvents(storage.events);
      } else {
        setStoredItems([]); setPersonalItems([]); setStorageEvents([]);
      }
      if (!me.clan) {
        const list = await apiRequest<{ clans: Clan[] }>('/api/clans');
        setClans(list.clans);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить клан.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const run = async (fn: () => Promise<unknown>) => {
    setAction(true);
    setError('');
    try {
      await fn();
      await refreshServerInventory();
      triggerHaptic('success');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка операции.');
      triggerHaptic('error');
    } finally {
      setAction(false);
    }
  };

  const createClan = () => run(async () => {
    await createPaidClan({name,tag,description});
    setShowCreate(false);
    setName('');
    setTag('');
    setDescription('');
  });

  const joinClan = (id: string) => run(() => apiRequest('/api/clan/' + id + '/join', { method: 'POST' }));

  const leaveClan = () => {
    const confirmDisband=clan?.role === 'owner' && members.length <= 1;
    const message=clan?.role === 'owner' ? confirmDisband ? 'Распустить клан и выйти? Вы последний участник. Казна и клановый склад будут удалены. Стоимость создания не возвращается.' : 'Выйти из клана? Руководство автоматически перейдёт старшему участнику: сначала офицеру. Стоимость создания не возвращается.' : 'Выйти из клана?';
    if (!window.confirm(localize(message))) return;
    run(() => apiRequest('/api/clan/leave', { method: 'POST', body:JSON.stringify({confirmDisband}) }));
  };

  const attackRaid = () => run(() => apiRequest('/api/clan/raid/attack', { method: 'POST', body: '{}' }));

  const moveItem = (item: StoredItem, action: 'deposit' | 'withdraw') => run(() =>
    apiRequest(`/api/clan/storage/${encodeURIComponent(item.id)}/${action}`, {
      method: 'POST', body: JSON.stringify({ quantity: item.quantity })
    })
  );
  const disposeStored = (action: 'sell' | 'disassemble', itemId?: string, upToRarity?: string) => {
    if (!window.confirm(localize(`Обработать ${itemId ? 'выбранную вещь' : `все вещи до редкости ${upToRarity}`} в хранилище?`))) return;
    run(() => apiRequest('/api/clan/storage/dispose', { method: 'POST', body: JSON.stringify({ action, itemId, upToRarity }) }));
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatText.trim();
    if (!text || action) return;
    setAction(true);
    try {
      if (player) await apiRequest('/api/profile/sync', {
        method: 'POST',
        body: JSON.stringify({ characterName: player.name, level: player.level, arenaRating: player.arenaRating })
      });
      const result = await apiRequest<{ message: ClanMessage }>('/api/clan/chat', {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      setMessages(prev => [...prev, result.message]);
      setChatText('');
      triggerHaptic('light');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить сообщение.');
    } finally {
      setAction(false);
    }
  };

  const visibleClans = clans.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.tag.toLowerCase().includes(search.toLowerCase())
  );

  if (!player) return null;

  return (
    <FolioPage className="space-y-3 pt-3">
      <BestiaryPanel className="rounded-xl p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg border border-[#514633] bg-[#111416] text-[#c7a365]">
              <RpgIcon kind="clan" size={24} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-[#b6a47f]">{localize("Союз охотников")}</div>
              <h2 className="font-cinzel text-lg font-bold text-slate-100">{localize("Кланы")}</h2>
            </div>
          </div>
          <button aria-label={localize("Обновить клан")} onClick={load} disabled={loading || action} className="rpg-icon-button">
            <RpgIcon kind="refresh" size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </BestiaryPanel>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200">
          {localize(error)}
        </div>
      )}

      {loading ? (
        <BestiaryPanel className="p-8 text-center text-xs text-slate-500">{localize("Загрузка кланов…")}</BestiaryPanel>
      ) : clan ? (
        <>
          <BestiaryPanel className="space-y-3 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-[#d5ba89]">[{clan.tag}]</span>
                  <h3 className="font-cinzel text-base font-bold text-slate-100">{clan.name}</h3>
                  {clan.role === 'owner' && <RpgIcon kind="crown" size={16} className="text-amber-300" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">{clan.description || localize('У клана пока нет описания.')}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-bold text-[#d5ba89]">{localize("Ур. ")}{localize(clan.level)}</div>
                <div className="text-[11px] text-slate-500">{localize(clan.xp.toLocaleString(intlLocale()))} XP</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-2 text-center">
                <RpgIcon kind="clan" size={16} className="mx-auto text-[#d5ba89]" />
                <div className="text-xs font-bold mt-1">{localize(clan.members_count)}/{localize(clan.max_members)}</div>
                <div className="text-[11px] text-slate-500">{localize("участники")}</div>
              </div>
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-2 text-center">
                <RpgIcon kind="gold" size={16} className="mx-auto text-amber-400" />
                <div className="text-xs font-bold mt-1">{localize(Number(clan.treasury_gold).toLocaleString(intlLocale()))}</div>
                <div className="text-[11px] text-slate-500">{localize("казна")}</div>
              </div>
              <div className="rounded-lg bg-slate-950 border border-slate-800 p-2 text-center">
                <RpgIcon kind="arena" size={16} className="mx-auto text-purple-400" />
                <div className="text-xs font-bold mt-1">{localize(clan.max_members)}{localize(" мест")}</div>
                <div className="text-[11px] text-slate-500">{localize("вместимость")}</div>
              </div>
            </div>

            <button
              onClick={leaveClan}
              disabled={action}
              className="rpg-button rpg-button-danger mt-3 w-full disabled:opacity-40"
            >
              <RpgIcon kind="leave" size={16} />{localize(" Выйти из клана")}</button>
          </BestiaryPanel>

          <BestiaryPanel className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] text-purple-400 font-mono uppercase">{localize("Еженедельный рейд")}</div>
                <h3 className="font-cinzel text-sm font-bold text-slate-100 mt-0.5">{localize(clan.raid_name)}</h3>
              </div>
              <RpgButton onClick={attackRaid} disabled={action || clan.raid_hp <= 0 && new Date(clan.raid_reset_at).getTime() > Date.now()} variant="primary" icon="attack" className="px-3 disabled:opacity-40">{localize("Удар")}</RpgButton>
            </div>
            <div className="mt-3 flex justify-between text-[11px] font-mono">
              <span className="text-purple-300">{localize("HP босса")}</span>
              <span>{localize(Number(clan.raid_hp).toLocaleString(intlLocale()))} / {localize(Number(clan.raid_max_hp).toLocaleString(intlLocale()))}</span>
            </div>
            <ProgressBar value={Number(clan.raid_hp)} max={Number(clan.raid_max_hp)} label="HP босса" className="mt-2" />
            <p className="mt-2 text-xs text-slate-500">{localize("Один удар в сутки. Победа: +")}{localize(clanRaidReward(clan.level, clan.projects?.research).xp)}{localize(" XP клана и +")}{localize(clanRaidReward(clan.level, clan.projects?.research).gold)}{localize(" золота в казну.")}</p>
          </BestiaryPanel>

          <BestiaryPanel className="space-y-2 p-3">
            <SectionTitle eyebrow="Развитие союза">{localize("Клановые проекты")}</SectionTitle>
            {(Object.keys(CLAN_PROJECTS) as ClanProject[]).map(project => {
              const level=clan.projects?.[project] || 0, cost=clanProjectCost(level);
              return <div key={project} className="rounded border border-slate-800 p-2 text-xs">
                <b>{localize(CLAN_PROJECTS[project].name)} · {localize(level)}/10</b><p className="text-slate-400">{localize(CLAN_PROJECTS[project].description)}</p>
                <RpgButton variant="secondary" disabled={action || level>=10 || !['owner','officer'].includes(clan.role || '')} onClick={()=>run(async()=>{
                  const key=`clan_project_${clan.id}_${project}`;
                  const id=localStorage.getItem(key) || createOperationId();localStorage.setItem(key,id);
                  await apiRequest('/api/clan/projects/upgrade',{method:'POST',body:JSON.stringify({project,operationId:id})});
                  localStorage.removeItem(key);
                })} className="mt-2 disabled:opacity-40">{localize(level>=10?'Максимум':`Улучшить · ${cost.gold} золота · ${cost.silver} серебра · ${cost.ore} руды`)}</RpgButton>
              </div>;
            })}
          </BestiaryPanel>

          <BestiaryPanel className="space-y-3 p-3">
            <div className="flex justify-between items-center">
              <h3 className="font-cinzel text-sm font-bold text-amber-200">{localize("Хранилище клана")}</h3>
              <span className="text-xs text-slate-400">{localize(storedItems.length)}{localize(" вещей")}</span>
            </div>
            <div className="text-xs text-slate-400">{localize("Вносить можно вещи с подтверждённым сервером происхождением. Старые локальные трофеи остаются личными.")}</div>
            <div className="text-xs text-amber-300">{localize("Казна: ")}{localize(Number(clan.treasury_gold || 0))}{localize(" золота · ")}{localize(Number((clan as Clan & { treasury_silver?: number }).treasury_silver || 0))}{localize(" серебра · ")}{localize(Number((clan as Clan & { treasury_ore?: number }).treasury_ore || 0))}{localize(" руды")}</div>
            <p className="text-xs text-slate-400">{localize("Пожертвования временно недоступны. Казна ещё не подключена к серверному кошельку.")}</p>
            <div className="space-y-1.5 max-h-44 overflow-y-auto">
              <div className="text-[11px] uppercase text-slate-500">{localize("Мои серверные вещи")}</div>
              {personalItems.filter(i => !i.locked && !i.equipped_slot && (!i.bound_clan_id || i.bound_clan_id === clan.id)).map(item => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg border border-slate-800 p-2 text-xs">
                  <RpgIcon kind="material" size={18} /><span className="flex-1 truncate">{localize(item.item_json.name)} ×{localize(item.quantity)}</span>
                  <button disabled={action} onClick={() => moveItem(item, 'deposit')} className="min-h-11 px-2 text-amber-300 disabled:opacity-40">{localize("Положить")}</button>
                </div>
              ))}
              {!personalItems.length && <div className="text-[11px] text-slate-600">{localize("Серверных вещей пока нет. Первое участие в рейде выдаёт личный предмет раз в неделю.")}</div>}
            </div>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              <div className="text-[11px] uppercase text-slate-500">{localize("Общие вещи")}</div>
              {storedItems.map(item => (
                <div key={item.id} className="rounded-lg border border-slate-800 p-2 flex items-center gap-2 text-xs">
                  <RpgIcon kind="material" size={18} />
                  <span className="flex-1 truncate">{localize(item.item_json.name)} ×{localize(item.quantity)} · {localize(item.item_json.rarity)}</span>
                  {canUseVault(clan.role || '') && <div className="flex flex-wrap gap-2 text-[11px]">
                    <button disabled={action} onClick={() => moveItem(item, 'withdraw')} className="min-h-11 px-1 text-[#d5ba89]">{localize("Забрать")}</button>
                    <SelectionField aria-label={localize(`Получатель ${item.item_json.name}`)} value={recipients[item.id]||''} disabled={action} onChange={e=>setRecipients(prev=>({...prev,[item.id]:e.target.value}))} className="min-h-11 w-20 rounded bg-slate-950"><option value="">{localize("Кому?")}</option>{members.map(m=><option key={m.telegram_id} value={m.telegram_id}>{m.display_name}</option>)}</SelectionField>
                    <button disabled={action||!recipients[item.id]} onClick={()=>run(()=>apiRequest(`/api/clan/storage/${item.id}/give`,{method:'POST',body:JSON.stringify({targetId:recipients[item.id]})}))} className="min-h-11 px-1 text-emerald-300 disabled:opacity-40">{localize("Выдать")}</button>
                    <button disabled={action} onClick={() => disposeStored('sell', item.id)} className="min-h-11 px-1 text-amber-300">{localize("Продать")}</button>
                    <button disabled={action} onClick={() => disposeStored('disassemble', item.id)} className="min-h-11 px-1 text-violet-300">{localize("Разобрать")}</button>
                  </div>}
                </div>
              ))}
              {!storedItems.length && <div className="text-[11px] text-slate-600">{localize("Хранилище пусто.")}</div>}
            </div>
            {canUseVault(clan.role || '') && storedItems.length > 0 && <div className="flex flex-wrap gap-2 items-center text-[11px]">
              <span className="text-slate-400">{localize("До редкости:")}</span>
              <SelectionField value={bulkRarity} onChange={e => setBulkRarity(e.target.value)} className="bg-slate-950 border border-slate-700 rounded p-1 text-slate-200">
                {['common','uncommon','rare','epic','legendary','mythic','ancient','divine'].map(r => <option key={r} value={r}>{localize(r)}</option>)}
              </SelectionField>
              <button disabled={action} onClick={() => disposeStored('sell', undefined, bulkRarity)} className="text-amber-300">{localize("Продать пачкой")}</button>
              <button disabled={action} onClick={() => disposeStored('disassemble', undefined, bulkRarity)} className="text-violet-300">{localize("Разобрать пачкой")}</button>
            </div>}
            {storageEvents.length > 0 && <div className="border-t border-slate-800 pt-2 space-y-1 max-h-24 overflow-y-auto text-[11px] text-slate-500">
              {storageEvents.map((event, index) => <div key={index}>{event.display_name}: {localize(event.action)} · {localize(event.item_name)} ×{localize(event.quantity)}</div>)}
            </div>}
          </BestiaryPanel>

          <ClanManagement clan={clan} members={members} busy={action} run={run} />

          <BestiaryPanel className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-cinzel text-xs font-bold text-slate-200">{localize("Клановый чат")}</h3>
              <span className="text-xs text-slate-500">{localize("серверный")}</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-auto mb-2">
              {messages.length ? messages.map(message => (
                <div key={message.id} className="p-2 rounded-lg bg-slate-950 border border-slate-900">
                  <div className="text-xs font-bold text-[#d5ba89]">{message.display_name}</div>
                  <div className="mt-0.5 break-words text-xs text-slate-300">{message.text}</div>
                </div>
              )) : (
                <div className="p-5 text-center text-[11px] text-slate-600">{localize("Чат пока пуст.")}</div>
              )}
            </div>
            <form onSubmit={sendMessage} className="flex gap-2">
              <input value={chatText} onChange={e => setChatText(e.target.value)} maxLength={500} placeholder={localize("Написать клану…")} className="flex-1 min-w-0 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs outline-none focus:border-cyan-500" />
              <RpgButton type="submit" variant="primary" icon="quest" disabled={action || !chatText.trim()} className="min-h-11 px-3 disabled:opacity-40" aria-label={localize("Отправить сообщение")} />
            </form>
          </BestiaryPanel>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <RpgButton variant="primary" icon="clan" onClick={() => setShowCreate(true)} className="w-full">{localize("Создать клан")}</RpgButton>
            <RpgButton variant="secondary" icon="map" onClick={load} className="w-full">{localize("Обновить список")}</RpgButton>
          </div>

          <div className="flex gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={localize("Название или тег…")} className="min-h-11 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm outline-none focus:border-cyan-500" />
          </div>

          <div className="space-y-2">
            {visibleClans.map(c => (
              <BestiaryPanel key={c.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg border border-slate-700 bg-cyan-950 font-mono text-xs font-bold text-[#d5ba89]">[{c.tag}]</div>
                  <div className="min-w-0 flex-1">
                    <div className="font-cinzel text-xs font-bold text-slate-100">{c.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{localize("Ур. ")}{localize(c.level)} · {localize(c.members_count)}/{localize(c.max_members)}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-slate-400">{c.description || localize('Без описания')}</div>
                  </div>
                  <RpgButton variant="secondary" icon="clan" onClick={() => joinClan(c.id)} disabled={action || c.members_count >= c.max_members || c.recruitment_open === false || player.level < (c.min_join_level || 1)} className="shrink-0 px-2 disabled:opacity-40">
                    {localize(c.recruitment_open === false ? 'Набор закрыт' : player.level < (c.min_join_level || 1) ? `С ур. ${c.min_join_level}` : 'Вступить')}
                  </RpgButton>
                </div>
              </BestiaryPanel>
            ))}
            {!visibleClans.length && <div className="p-8 text-center text-xs text-slate-600">{localize("Кланы не найдены.")}</div>}
          </div>
        </>
      )}

      {showCreate && (
        <div className="bottom-sheet-backdrop fixed inset-0 z-50 flex items-end justify-center p-2 backdrop-blur-sm sm:items-center">
          <div role="dialog" aria-modal="true" aria-label={localize("Создать клан")} className="dialog-frame w-full max-w-lg p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-cinzel text-sm font-bold text-[#d5ba89]">{localize("Создать клан")}</h3>
              <button className="rpg-icon-button" aria-label={localize("Закрыть")} onClick={() => setShowCreate(false)}><span aria-hidden="true" className="text-xl">×</span></button>
            </div>
            <div className="space-y-2 mt-3">
              <input value={name} onChange={e => setName(e.target.value)} maxLength={32} placeholder={localize("Название клана")} className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm outline-none focus:border-cyan-500" />
              <input value={tag} onChange={e => setTag(e.target.value.toUpperCase())} maxLength={6} placeholder={localize("Тег, например NEXUS")} className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm font-mono outline-none focus:border-cyan-500" />
              <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={280} placeholder={localize("Описание и правила клана")} rows={3} className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-500" />
              <p className="text-xs text-amber-200">{localize("Стоимость: ")}{localize(clanCreationCost(premium.active).toLocaleString(intlLocale()))}{localize(" золота")}{localize(premium.active ? ' · Скидка Premium 50%' : ' · С Premium — 50 000 золота')}{localize(". Ваш баланс: ")}{localize(player.gold.toLocaleString(intlLocale()))}{localize(" золота.")}</p>
              <RpgButton variant="primary" icon="clan" onClick={createClan} disabled={action || premium.loading || name.trim().length < 3 || tag.trim().length < 2} className="w-full disabled:opacity-40">
                {localize(action ? 'Создание…' : `Создать за ${clanCreationCost(premium.active).toLocaleString(intlLocale())} золота`)}
              </RpgButton>
            </div>
          </div>
        </div>
      )}
    </FolioPage>
  );
};
