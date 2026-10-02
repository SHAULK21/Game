import React, { useState } from 'react';
import { RpgIcon } from './RpgIcon';

/** Key the image state by URL, so a failed portrait cannot hide the next selection. */
export const Portrait: React.FC<{ src: string; alt: string; className?: string; fallback?: 'monster' | 'character' }> = ({ src, ...props }) =>
  <PortraitImage key={src} src={src} {...props} />;
const PortraitImage: React.FC<{ src: string; alt: string; className?: string; fallback?: 'monster' | 'character' }> = ({ src, alt, className = '', fallback = 'monster' }) => {
  const [failed, setFailed] = useState(!src);
  return failed
    ? <span role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={!alt} className={`portrait-fallback ${className}`}><RpgIcon kind={fallback} size={48} /></span>
    : <img src={src} alt={alt} className={className} decoding="async" onError={() => setFailed(true)} />;
};
