// src/app/game/zone/1/page.tsx
// Route: /game/zone/1
// Dynamic import keeps Phaser out of SSR bundle

import dynamic from 'next/dynamic'


// Placeholder loading component with ocean theme
const Zone1Game = dynamic(
  () => import('@/components/game/Zone1Game'),
  {
    // Disable SSR for this component since Phaser relies on browser APIs 
    ssr: false,
    loading: () => (
      <div className="w-screen h-screen bg-[#1a6ec7] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-6 animate-bounce">🌊</div>
          <p className="text-white/80 text-xl font-bold tracking-wide mb-3">
            Loading Pebble Shore…
          </p>
          <div className="w-48 h-2 bg-white/20 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-teal-400 rounded-full animate-[loading_1.5s_ease-in-out_infinite]" />
          </div>
        </div>

        <style>{`
          @keyframes loading {
            0%   { width: 0%; }
            50%  { width: 80%; }
            100% { width: 100%; }
          }
        `}</style>
      </div>
    ),
  }
)

export default function Zone1Page({
  searchParams,
}: {
  searchParams: { difficulty?: string }
}) {
  const difficulty = searchParams.difficulty ? parseInt(searchParams.difficulty, 10) : undefined
  return <Zone1Game difficulty={difficulty} />
}