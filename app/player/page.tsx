import dynamic from 'next/dynamic';

const PlayerContent = dynamic(() => import('./player-content'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-neutral-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 animate-pulse" />
        <div className="text-sm text-neutral-400 animate-pulse">Loading Sonic Walkscape...</div>
      </div>
    </div>
  )
});

export default function PagePlayer() {
  return <PlayerContent />;
}
