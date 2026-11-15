import { table, integer, text } from 'sdk/db';

export const gameAtomicDocuments = table('game_atomic_documents', {
  id: text('id').primaryKey(),
  revision: integer('revision').notNull().default(0),
  document: text('document').notNull(),
});

// One full save of the hero per player: the game keeps the hero in the device's memory, this copy lets
// the same hero be played from Telegram and the Android app (newest copy wins, conflicts are asked).
export const cloudSaves = table('cloud_saves', {
  userId: text('user_id').primaryKey(),
  rev: integer('rev').notNull().default(0),
  savedAt: text('saved_at').notNull(),
  device: text('device').notNull().default(''),
  level: integer('level').notNull().default(1),
  heroName: text('hero_name').notNull().default(''),
  data: text('data').notNull(),
});

// Your database tables go here as named exports. Deploying this file registers the
// schema; applying the changes (a migration) updates the database.

// Uncomment to define your first table:
// export const users = table('users', {
//   id:   integer('id').primaryKey({ autoIncrement: true }),
//   name: text('name').notNull(),
// });
