import React from 'react';
import { RpgIcon, RpgIconKind } from './RpgIcon';

type PanelProps = React.PropsWithChildren<{ className?: string }>;

export const FolioPage: React.FC<PanelProps> = ({ children, className = '' }) =>
  <div className={`folio-page mx-auto w-full max-w-lg px-3 pb-24 ${className}`}>{children}</div>;

export const BestiaryPanel: React.FC<PanelProps> = ({ children, className = '' }) =>
  <section className={`bestiary-panel ${className}`}>{children}</section>;

export const LeatherPanel: React.FC<PanelProps> = ({ children, className = '' }) =>
  <section className={`leather-panel ${className}`}>{children}</section>;

export const OrnamentDivider: React.FC<{ className?: string }> = ({ className = '' }) =>
  <div aria-hidden="true" className={`ornament-divider ${className}`} />;

export const ResourceBadge: React.FC<{
  kind: 'gold' | 'silver' | 'energy' | 'stamina' | 'arena';
  value: React.ReactNode;
  label?: string;
  onClick?: () => void;
  title?: string;
  className?: string;
}> = ({ kind, value, label, onClick, title, className = '' }) => {
  const content = <><RpgIcon kind={kind} size={16} /><span>{label ? `${label} ` : ''}{value}</span></>;
  return onClick
    ? <button type="button" onClick={onClick} title={title} className={`resource-badge is-${kind} min-h-11 ${className}`}>{content}</button>
    : <span title={title} className={`resource-badge is-${kind} ${className}`}>{content}</span>;
};

export const RpgButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
  icon?: RpgIconKind;
}> = ({ children, className = '', variant = 'secondary', icon, type = 'button', ...props }) => (
  <button type={type} className={`rpg-button rpg-button-${variant} ${className}`} {...props}>
    {icon && <RpgIcon kind={icon} size={18} />}
    {children}
  </button>
);

export const RpgIconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: RpgIconKind;
  label: string;
}> = ({ icon, label, className = '', type = 'button', ...props }) => (
  <button type={type} aria-label={label} title={label} className={`rpg-icon-button ${className}`} {...props}>
    <RpgIcon kind={icon} size={19} />
  </button>
);

export const BestiaryEntry: React.FC<{
  title: string;
  subtitle?: string;
  image?: string;
  selected?: boolean;
  locked?: boolean;
  marker?: string;
  onClick: () => void;
}> = ({ title, subtitle, image, selected = false, locked = false, marker, onClick }) => (
  <button type="button" onClick={onClick} aria-pressed={selected} className={`bestiary-entry bestiary-entry-row ${selected ? 'is-selected' : ''} ${locked ? 'is-locked' : ''}`}>
    <span className={`bestiary-entry-portrait ${locked ? 'is-locked' : ''}`}>
      {image
        ? <img src={image} alt="" className={`h-full w-full object-cover ${locked ? 'scale-110 grayscale blur-[2px] brightness-50' : ''}`} />
        : <RpgIcon kind="monster" size={27} className={locked ? 'text-[#73665a]' : 'text-[#98805b]'} />}
      {locked && <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-black/25 text-lg font-serif text-[#c2b7a5]">?</span>}
    </span>
    <span className="min-w-0 flex-1 text-left">
      <span className="block truncate text-xs font-semibold">{locked ? 'Неизвестный след' : title}</span>
      {subtitle && <span className="mt-0.5 block text-[11px] text-[#918c82]">{subtitle}</span>}
    </span>
    {marker && <span className={`bestiary-marker ${marker === 'Босс' ? 'is-boss' : 'is-elite'}`}>{marker}</span>}
    <span aria-hidden="true" className="bestiary-entry-chevron">›</span>
  </button>
);

export const ItemSlot: React.FC<{
  label: string;
  itemName?: string;
  icon?: RpgIconKind;
  className?: string;
}> = ({ label, itemName, icon = 'inventory', className = '' }) => (
  <div className={`rarity-frame flex min-h-[68px] items-center gap-2 rounded-lg border bg-[#101315] p-2 ${className}`}>
    <RpgIcon kind={icon} size={22} className="text-[#a48b60]" />
    <div className="min-w-0"><div className="text-[10px] uppercase tracking-wide text-[#918c82]">{label}</div><div className="truncate text-xs text-[#d8d1c4]">{itemName || 'Пусто'}</div></div>
  </div>
);

export const StatRow: React.FC<{ label: string; value: React.ReactNode; tone?: 'default' | 'hp' | 'mana' | 'energy' }> = ({ label, value, tone = 'default' }) => (
  <div className="stat-row flex items-center justify-between gap-3 py-1.5 text-xs">
    <span className="text-[#918c82]">{label}</span>
    <strong className={tone === 'hp' ? 'text-[#cf8885]' : tone === 'mana' ? 'text-[#88a8d0]' : tone === 'energy' ? 'text-[#d1ad67]' : 'text-[#d8d1c4]'}>{value}</strong>
  </div>
);

export const RarityFrame: React.FC<PanelProps & { rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' }> = ({ children, className = '', rarity = 'common' }) => (
  <div className={`rarity-frame rounded-lg border ${rarity !== 'common' && rarity !== 'uncommon' ? `is-${rarity}` : ''} ${className}`}>{children}</div>
);

export const ProgressBar: React.FC<{
  value: number;
  max: number;
  tone?: 'hp' | 'mana' | 'energy';
  label?: string;
  className?: string;
}> = ({ value, max, tone = 'hp', label, className = '' }) => {
  const percent = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return <div className={className}>
    {(label || max > 0) && <div className="mb-1 flex items-center justify-between gap-2 text-[11px] tabular-nums"><span className="text-[#918c82]">{label || tone.toUpperCase()}</span><span className="text-[#d8d1c4]">{value}/{max}</span></div>}
    <div role="progressbar" aria-label={label || tone.toUpperCase()} aria-valuemin={0} aria-valuemax={Math.max(0, max)} aria-valuenow={Math.max(0, Math.min(value, max))} className="progress-track h-2"><div className={`progress-fill is-${tone}`} style={{ width: `${percent}%` }} /></div>
  </div>;
};

export const SectionTitle: React.FC<React.PropsWithChildren<{ eyebrow?: string; action?: React.ReactNode; className?: string }>> = ({ children, eyebrow, action, className = '' }) => (
  <div className={`flex items-end justify-between gap-3 ${className}`}>
    <div>{eyebrow && <div className="text-[10px] uppercase tracking-[.16em] text-[#918c82]">{eyebrow}</div>}<h2 className="section-title text-base">{children}</h2></div>
    {action}
  </div>
);

export const CodexTabs: React.FC<{
  tabs: Array<{ id: string; label: string }>;
  active: string;
  onChange: (id: string) => void;
  className?: string;
}> = ({ tabs, active, onChange, className = '' }) => (
  <div role="tablist" className={`flex gap-2 overflow-x-auto border-b border-[#343638] ${className}`}>
    {tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} onClick={() => onChange(tab.id)} className={`codex-tab shrink-0 px-3 text-xs font-semibold ${active === tab.id ? 'is-active' : ''}`}>{tab.label}</button>)}
  </div>
);

export const BottomSheet: React.FC<React.PropsWithChildren<{ open: boolean; title: string; onClose: () => void }>> = ({ open, title, onClose, children }) => !open ? null : (
  <div className="bottom-sheet-backdrop fixed inset-0 z-[70] flex items-end justify-center" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={title} className="dialog-frame w-full max-w-lg rounded-b-none p-4 pb-safe" onClick={event => event.stopPropagation()}>
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#6b665d]" />
      <h2 className="section-title mb-3 text-lg">{title}</h2>{children}
    </section>
  </div>
);

export const DialogFrame: React.FC<React.PropsWithChildren<{ open: boolean; title: string; onClose: () => void; className?: string }>> = ({ open, title, onClose, className = '', children }) => !open ? null : (
  <div className="bottom-sheet-backdrop fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={title} className={`dialog-frame w-full max-w-sm p-4 ${className}`} onClick={event => event.stopPropagation()}>
      <h2 className="section-title mb-3 text-lg">{title}</h2>{children}
    </section>
  </div>
);
