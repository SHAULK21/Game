import type React from 'react';
import type {getLanguage} from '../i18n/locale';
import type {sound} from '../utils/audio';
import type {apiRequest} from '../utils/api';
import type {getTelegramUser, triggerHaptic} from '../utils/telegram';
import type {readResetVersion, readAccountSave, removeAccountSave} from '../utils/accountReset';
import type {useBalanceTelemetry} from '../hooks/useBalanceTelemetry';

/** Environment boundary for the shared game rules. Server actors provide
 * account-scoped storage/hooks and never install a browser or global session. */
export interface GameEngineRuntime {
  hooks: Pick<typeof React, 'useState' | 'useRef' | 'useMemo' | 'useCallback' | 'useEffect'>;
  localStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  getTelegramUser: typeof getTelegramUser;
  getLanguage: typeof getLanguage;
  readResetVersion: typeof readResetVersion;
  readAccountSave: typeof readAccountSave;
  removeAccountSave: typeof removeAccountSave;
  isCurrentUserAdmin: () => boolean;
  sound: typeof sound;
  triggerHaptic: typeof triggerHaptic;
  apiRequest: typeof apiRequest;
  useBalanceTelemetry: typeof useBalanceTelemetry;
  Date: DateConstructor;
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
  setInterval: typeof globalThis.setInterval;
  clearInterval: typeof globalThis.clearInterval;
}
