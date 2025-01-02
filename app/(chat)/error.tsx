'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Chat error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      <div className="flex items-center gap-2 text-destructive mb-4">
        <AlertCircle className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Something went wrong!</h2>
      </div>
      <p className="text-muted-foreground text-center mb-6">
        We encountered an error while loading your chat. Please try again.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => window.location.href = '/'} variant="outline">
          Go Home
        </Button>
        <Button onClick={() => reset()}>
          Try Again
        </Button>
      </div>
    </div>
  );
} 