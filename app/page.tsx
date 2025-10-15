'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the player page
    router.push('/player');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100 flex items-center justify-center">
      <div className="text-center">
        <div className="h-12 w-12 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg animate-pulse" />
        <div className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-2">
          Sonic Walkscape
        </div>
        <div className="text-sm text-neutral-400">
          Redirecting to player...
        </div>
      </div>
    </div>
  );
}
