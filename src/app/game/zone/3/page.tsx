// src/app/game/zone/3/page.tsx
// Route: /game/zone/3
// Dynamic import keeps Phaser out of SSR bundle

import dynamic from 'next/dynamic'

const Zone3Game = dynamic(
  () => import('@/components/game/Zone3Game'),
  {
    ssr: false,
    loading: () => (
      <div className="w-screen h-screen bg-[#1a0800] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-6 animate-bounce">⚙️</div>
          <p className="text-orange-200/80 text-xl font-bold tracking-wide mb-3">
            Loading Iron Summit…
          </p>
          <div className="w-48 h-2 bg-orange-900/40 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-orange-400 rounded-full animate-[loading_1.5s_ease-in-out_infinite]" />
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

export default function Zone3Page() {
  return <Zone3Game />
}
