import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import { Chat } from '@/components/chat';
import { getChatById, saveChat, getMessagesByChatId } from '@/lib/db/queries';
import { DEFAULT_MODEL_NAME } from '@/lib/ai/models';
import { cookies } from 'next/headers';
import { logWithTimestamp } from '@/lib/utils';
import type { Message } from 'ai';

interface Props {
  params: {
    id: string
  }
}

export default async function ChatPage({ params }: Props) {
  const nextjs15 = await params;
  const id = nextjs15.id;
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect('/sign-in');
  }

  logWithTimestamp('Loading chat page:', { id });

  const cookieStore = await cookies();
  const modelId = cookieStore.get('model-id')?.value || DEFAULT_MODEL_NAME;

  // Get the chat
  const chat = await getChatById({ id });
  const dbMessages = chat ? await getMessagesByChatId({ id }) : [];
  
  // Convert DB messages to AI Message format
  const messages: Message[] = dbMessages.map(msg => ({
    id: msg.id,
    content: String(msg.content),
    role: msg.role as Message['role'],
    createdAt: msg.createdAt
  }));

  if (!chat) {
    // Create new chat if it doesn't exist
    await saveChat({
      id,
      userId: session.user.id,
      title: 'New Chat',
      createdAt: new Date()
    });
  }

  return (
    <Chat 
      id={id}
      initialMessages={messages}
      selectedModelId={modelId}
      selectedVisibilityType={chat?.visibility || 'private'}
      isReadonly={false}
    />
  );
}
