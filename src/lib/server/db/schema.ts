import { sqliteTable, integer, text } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	age: integer('age'),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull()
});

export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

export type Session = typeof session.$inferSelect;

export type User = typeof user.$inferSelect;

export const note = sqliteTable('note', {
	id: text('id').primaryKey(),
	title: text('title').notNull(),
	content: text('content').notNull(),
	created_on: integer('created_on', { mode: 'timestamp' }).notNull(),
	modified_on: integer('modified_on', { mode: 'timestamp' }).notNull(),
	tags: text('tags'), // Storing tags as a comma-separated string or JSON string
	canonical_path: text('canonical_path').unique()
});

export type Note = typeof note.$inferSelect;
export type NewNote = typeof note.$inferInsert;
