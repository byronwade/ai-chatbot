import 'server-only';

import { genSaltSync, hashSync } from 'bcrypt-ts';
import { and, asc, desc, eq, gt, gte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

import {
  user,
  chat,
  type User,
  document,
  type Suggestion,
  suggestion,
  type Message,
  message,
  vote,
} from './schema';
import { BlockKind } from '@/components/block';

// Add logging utility
function logWithTimestamp(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[DB ${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite);

logWithTimestamp('Database initialized');

export async function getUser(email: string): Promise<Array<User>> {
  try {
    logWithTimestamp('Getting user by email:', { email });
    const users = await db.select().from(user).where(eq(user.email, email));
    logWithTimestamp('User lookup result:', { found: users.length > 0 });
    return users;
  } catch (error) {
    logWithTimestamp('Failed to get user from database:', { error, email });
    throw error;
  }
}

export async function createUser(email: string, password: string) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);
  const userId = nanoid();

  try {
    logWithTimestamp('Creating new user:', { email, userId });
    const result = await db.insert(user).values({ 
      id: userId,
      email, 
      password: hash 
    });
    logWithTimestamp('User created successfully:', { userId });
    return result;
  } catch (error) {
    logWithTimestamp('Failed to create user:', { error, email });
    throw error;
  }
}

export async function saveChat({
  id,
  userId,
  title,
  createdAt = new Date(),
}: {
  id: string;
  userId: string;
  title: string;
  createdAt?: Date;
}) {
  try {
    logWithTimestamp('Saving chat:', { chatId: id, userId, title });
    
    // First check if user exists
    const users = await db.select().from(user).where(eq(user.id, userId));
    
    // If user doesn't exist, create it
    if (users.length === 0) {
      logWithTimestamp('User not found, creating new user:', { userId });
      await db.insert(user).values({
        id: userId,
        email: `${userId}@example.com`, // Temporary email
        password: null // No password needed for this case
      });
    }
    
    const result = await db.insert(chat).values({
      id,
      createdAt,
      userId,
      title,
    });
    logWithTimestamp('Chat saved successfully:', { chatId: id });
    return result;
  } catch (error) {
    logWithTimestamp('Failed to save chat:', { error, chatId: id, userId });
    throw error;
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    logWithTimestamp('Deleting chat and related data:', { chatId: id });
    
    // Delete votes first
    const voteResult = await db.delete(vote).where(eq(vote.chatId, id));
    logWithTimestamp('Deleted votes:', { chatId: id });
    
    // Delete messages
    const messageResult = await db.delete(message).where(eq(message.chatId, id));
    logWithTimestamp('Deleted messages:', { chatId: id });
    
    // Delete chat
    const chatResult = await db.delete(chat).where(eq(chat.id, id));
    logWithTimestamp('Deleted chat:', { chatId: id });

    return chatResult;
  } catch (error) {
    logWithTimestamp('Failed to delete chat:', { error, chatId: id });
    throw error;
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  try {
    logWithTimestamp('Getting chats for user:', { userId: id });
    const chats = await db
      .select()
      .from(chat)
      .where(eq(chat.userId, id))
      .orderBy(desc(chat.createdAt));
    logWithTimestamp('Retrieved chats:', { userId: id, count: chats.length });
    return chats;
  } catch (error) {
    logWithTimestamp('Failed to get chats for user:', { error, userId: id });
    throw error;
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    logWithTimestamp('Getting chat by ID:', { chatId: id });
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    logWithTimestamp('Chat lookup result:', { 
      chatId: id, 
      found: !!selectedChat,
      details: selectedChat ? {
        title: selectedChat.title,
        userId: selectedChat.userId,
        createdAt: selectedChat.createdAt
      } : null
    });
    return selectedChat;
  } catch (error) {
    logWithTimestamp('Failed to get chat by ID:', { error, chatId: id });
    throw error;
  }
}

export async function saveMessages({ messages }: { messages: Array<Message> }) {
  try {
    logWithTimestamp('Saving messages:', { 
      count: messages.length,
      chatId: messages[0]?.chatId,
      messageIds: messages.map(m => m.id)
    });
    const result = await db.insert(message).values(messages);
    logWithTimestamp('Messages saved successfully');
    return result;
  } catch (error) {
    logWithTimestamp('Failed to save messages:', { 
      error, 
      messageCount: messages.length,
      chatId: messages[0]?.chatId 
    });
    throw error;
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    logWithTimestamp('Getting messages for chat:', { chatId: id });
    const messages = await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
    logWithTimestamp('Retrieved messages:', { 
      chatId: id, 
      count: messages.length,
      roles: messages.map(m => m.role)
    });
    return messages;
  } catch (error) {
    logWithTimestamp('Failed to get messages for chat:', { error, chatId: id });
    throw error;
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: 'up' | 'down';
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === 'up' })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === 'up',
    });
  } catch (error) {
    console.error('Failed to upvote message in database', error);
    throw error;
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    console.error('Failed to get votes by chat id from database', error);
    throw error;
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: BlockKind;
  content: string;
  userId: string;
}) {
  try {
    return await db.insert(document).values({
      id,
      title,
      kind,
      content,
      userId,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Failed to save document in database');
    throw error;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (error) {
    console.error('Failed to get document by id from database');
    throw error;
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp),
        ),
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)));
  } catch (error) {
    console.error(
      'Failed to delete documents by id after timestamp from database',
    );
    throw error;
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Array<Suggestion>;
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    console.error('Failed to save suggestions in database');
    throw error;
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (error) {
    console.error(
      'Failed to get suggestions by document version from database',
    );
    throw error;
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    console.error('Failed to get message by id from database');
    throw error;
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    return await db
      .delete(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
      );
  } catch (error) {
    console.error(
      'Failed to delete messages by id after timestamp from database',
    );
    throw error;
  }
}

export async function updateChatVisiblityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: 'private' | 'public';
}) {
  try {
    return await db.update(chat).set({ visibility }).where(eq(chat.id, chatId));
  } catch (error) {
    console.error('Failed to update chat visibility in database');
    throw error;
  }
}
