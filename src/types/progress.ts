import type {GameContextType} from '../context/GameContext';
import type {ProgressSave} from '../../server/progressValidation';
import type {publicState} from '../../server/expeditions/store';

export type PublicGameView = {[K in keyof GameContextType as GameContextType[K] extends (...args: any[]) => any ? never : K]: GameContextType[K]};
export type PublicExpeditions = ReturnType<typeof publicState>;
export interface ProgressEnvelope {
  protocol: 'server-actions-v1';
  ownerId: string;
  resetVersion: number;
  version: number;
  sessionGeneration: number;
  activeHere: boolean;
  writerPresent: boolean;
  migrationOpen: boolean;
  canonical: boolean;
  save: ProgressSave | null;
  game: PublicGameView | null;
  expeditions: PublicExpeditions | null;
  serverTime: number;
  nextTickAt: number | null;
  cues: Array<{name: string; args: unknown[]}>;
}
export interface ProgressOperationResult extends ProgressEnvelope {
  operation: {id: string; outcome: 'applied' | 'rejected'; result: any; replayed: boolean};
}
