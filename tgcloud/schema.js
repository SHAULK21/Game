import { table, integer, text } from 'sdk/db';

export const gameAtomicDocuments = table('game_atomic_documents', {
  id: text('id').primaryKey(),
  revision: integer('revision').notNull().default(0),
  document: text('document').notNull(),
});

// Your database tables go here as named exports. Deploying this file registers the
// schema; applying the changes (a migration) updates the database.

// Uncomment to define your first table:
// export const users = table('users', {
//   id:   integer('id').primaryKey({ autoIncrement: true }),
//   name: text('name').notNull(),
// });
