import { cookies } from 'next/headers';
import { auth } from '@/app/(auth)/auth';
import { Chat } from '@/components/chat';
import { DEFAULT_MODEL_NAME, models } from '@/lib/ai/models';
import { generateUUID } from '@/lib/utils';
import { DataStreamHandler } from '@/components/data-stream-handler';
import { saveChat } from '@/lib/db/queries';

// Add logging utility
function logWithTimestamp(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[PAGE ${timestamp}] ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

export default async function Page() {
  const id = generateUUID();

  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Not authenticated');
  }

  // Create a new chat in the database
  await saveChat({
    id,
    userId: session.user.id,
    title: 'New Chat'
  });

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get('model-id')?.value;

  logWithTimestamp('Cookie model ID:', { modelIdFromCookie });
  logWithTimestamp('Available models:', models.map(m => ({ id: m.id, name: m.name })));

  const selectedModelId =
    models.find((model) => model.id === modelIdFromCookie)?.id ||
    DEFAULT_MODEL_NAME;

  logWithTimestamp('Selected model:', { 
    selectedModelId,
    isDefault: selectedModelId === DEFAULT_MODEL_NAME,
    modelDetails: models.find(m => m.id === selectedModelId)
  });

  return (
    <>
      <Chat
        key={id}
        id={id}
        initialMessages={[]}
        selectedModelId={selectedModelId}
        selectedVisibilityType="private"
        isReadonly={false}
      />
      <DataStreamHandler id={id} />
    </>
  );
}
