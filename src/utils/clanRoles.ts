export type ClanRole = 'owner' | 'officer' | 'quartermaster' | 'veteran' | 'member' | 'recruit';
export const CLAN_ROLE_LABELS: Record<ClanRole,string> = {owner:'Глава',officer:'Офицер',quartermaster:'Казначей',veteran:'Ветеран',member:'Участник',recruit:'Новичок'};
export const canUseVault = (role: string) => ['owner','officer','quartermaster'].includes(role);
export const canManageMember = (actor: string, target: string) => actor === 'owner' && target !== 'owner' || actor === 'officer' && ['veteran','member','recruit'].includes(target);
export const canAssignRole = (actor: string, target: string, role: string) => canManageMember(actor,target) && (actor === 'owner' ? ['officer','quartermaster','veteran','member','recruit'].includes(role) : ['veteran','member','recruit'].includes(role));
