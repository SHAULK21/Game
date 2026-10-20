import {build} from 'vite';
import {buildGameEngine} from './build-game-engine.mjs';
import {buildFlutterInventory} from './build-flutter-inventory.mjs';
process.env.VITE_GAME_BACKEND = 'telegram';
await buildFlutterInventory();
await build();
await import('./audit-frontend-loading.mjs');
await buildGameEngine();
await import('./build-native-engine.mjs');
