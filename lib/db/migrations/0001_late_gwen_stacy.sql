CREATE TABLE `BlogPost` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`topic` text NOT NULL,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`performance` integer DEFAULT 0 NOT NULL,
	`metadata` blob,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`blogPostId` text NOT NULL,
	`userId` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`blogPostId`) REFERENCES `BlogPost`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Page` (
	`id` text PRIMARY KEY NOT NULL,
	`websiteId` text NOT NULL,
	`url` text NOT NULL,
	`content` text NOT NULL,
	`title` text,
	`description` text,
	`lastScanned` integer NOT NULL,
	FOREIGN KEY (`websiteId`) REFERENCES `Website`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ScrapeResult` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`description` text,
	`content` text,
	`metadata` text,
	`timestamp` integer NOT NULL,
	`size` integer NOT NULL,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Trigram` (
	`id` text PRIMARY KEY NOT NULL,
	`trigram` text NOT NULL,
	`pageId` text NOT NULL,
	`frequency` integer NOT NULL,
	FOREIGN KEY (`pageId`) REFERENCES `Page`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Website` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`userId` text NOT NULL,
	`lastScanned` integer,
	`metadata` blob,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_Suggestion` (
	`id` text PRIMARY KEY NOT NULL,
	`documentId` text NOT NULL,
	`documentCreatedAt` integer NOT NULL,
	`originalText` text NOT NULL,
	`suggestedText` text NOT NULL,
	`description` text,
	`isResolved` integer DEFAULT false NOT NULL,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`documentId`,`documentCreatedAt`) REFERENCES `Document`(`id`,`createdAt`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_Suggestion`("id", "documentId", "documentCreatedAt", "originalText", "suggestedText", "description", "isResolved", "userId", "createdAt") SELECT "id", "documentId", "documentCreatedAt", "originalText", "suggestedText", "description", "isResolved", "userId", "createdAt" FROM `Suggestion`;--> statement-breakpoint
DROP TABLE `Suggestion`;--> statement-breakpoint
ALTER TABLE `__new_Suggestion` RENAME TO `Suggestion`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `Message` ADD `userId` text NOT NULL REFERENCES User(id);