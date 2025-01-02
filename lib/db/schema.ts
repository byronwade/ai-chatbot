import type { InferSelectModel } from 'drizzle-orm';
import {
  text,
  integer,
  sqliteTable,
  blob,
  primaryKey,
  foreignKey,
} from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('User', {
  id: text('id').primaryKey().notNull(),
  email: text('email').notNull(),
  password: text('password'),
});

export type User = InferSelectModel<typeof user>;

export const chat = sqliteTable('Chat', {
  id: text('id').primaryKey().notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  title: text('title').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  visibility: text('visibility', { enum: ['public', 'private'] })
    .notNull()
    .default('private'),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = sqliteTable("Message", {
	id: text("id").primaryKey().notNull(),
	chatId: text("chatId")
		.notNull()
		.references(() => chat.id),
	userId: text("userId")
		.notNull()
		.references(() => user.id),
	role: text("role").notNull(),
	content: blob("content", { mode: "json" }).notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export type Message = InferSelectModel<typeof message>;

export const vote = sqliteTable('Vote', {
  chatId: text('chatId')
    .notNull()
    .references(() => chat.id),
  messageId: text('messageId')
    .notNull()
    .references(() => message.id),
  isUpvoted: integer('isUpvoted', { mode: 'boolean' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.chatId, table.messageId] }),
}));

export type Vote = InferSelectModel<typeof vote>;

export const document = sqliteTable('Document', {
  id: text('id').notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  title: text('title').notNull(),
  content: text('content'),
  kind: text('kind', { enum: ['text', 'code'] })
    .notNull()
    .default('text'),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.id, table.createdAt] }),
}));

export type Document = InferSelectModel<typeof document>;

export const suggestion = sqliteTable('Suggestion', {
  id: text('id').notNull(),
  documentId: text('documentId').notNull(),
  documentCreatedAt: integer('documentCreatedAt', { mode: 'timestamp' }).notNull(),
  originalText: text('originalText').notNull(),
  suggestedText: text('suggestedText').notNull(),
  description: text('description'),
  isResolved: integer('isResolved', { mode: 'boolean' }).notNull().default(false),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.id] }),
  documentRef: foreignKey({
    columns: [table.documentId, table.documentCreatedAt],
    foreignColumns: [document.id, document.createdAt],
  }),
}));

export type Suggestion = InferSelectModel<typeof suggestion>;

export const scrapeResult = sqliteTable('ScrapeResult', {
  id: text('id').primaryKey().notNull(),
  url: text('url').notNull(),
  title: text('title'),
  description: text('description'),
  content: text('content'),
  metadata: text('metadata'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  size: integer('size').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
});

export type ScrapeResult = InferSelectModel<typeof scrapeResult>;

export const blogPosts = sqliteTable('BlogPost', {
  id: text('id').primaryKey().notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  topic: text('topic').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp' }).notNull(),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  performance: integer('performance').notNull().default(0),
  metadata: blob('metadata', { mode: 'json' }),
});

export type BlogPost = InferSelectModel<typeof blogPosts>;

export const feedback = sqliteTable('Feedback', {
  id: text('id').primaryKey().notNull(),
  blogPostId: text('blogPostId')
    .notNull()
    .references(() => blogPosts.id),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: integer('createdAt', { mode: 'timestamp' }).notNull(),
});

export type Feedback = InferSelectModel<typeof feedback>;

export const websites = sqliteTable('Website', {
  id: text('id').primaryKey().notNull(),
  url: text('url').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id),
  lastScanned: integer('lastScanned', { mode: 'timestamp' }),
  metadata: blob('metadata', { mode: 'json' }),
});

export type Website = InferSelectModel<typeof websites>;

export const pages = sqliteTable('Page', {
  id: text('id').primaryKey().notNull(),
  websiteId: text('websiteId')
    .notNull()
    .references(() => websites.id),
  url: text('url').notNull(),
  content: text('content').notNull(),
  title: text('title'),
  description: text('description'),
  lastScanned: integer('lastScanned', { mode: 'timestamp' }).notNull(),
});

export type Page = InferSelectModel<typeof pages>;

export const trigrams = sqliteTable('Trigram', {
  id: text('id').primaryKey().notNull(),
  trigram: text('trigram').notNull(),
  pageId: text('pageId')
    .notNull()
    .references(() => pages.id),
  frequency: integer('frequency').notNull(),
});

export type Trigram = InferSelectModel<typeof trigrams>;
