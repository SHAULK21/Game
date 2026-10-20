import {build} from 'vite';
import {buildGameEngine} from './build-game-engine.mjs';
process.env.VITE_GAME_BACKEND = 'telegram';
await build();
await import('./audit-frontend-loading.mjs');
await buildGameEngine();
await import('./build-native-engine.mjs');
