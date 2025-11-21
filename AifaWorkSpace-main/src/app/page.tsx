'use client';

import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Toolbar from '@/components/Toolbar';

// Dynamically import the canvas to avoid SSR issues with Konva
const WhiteboardCanvas = dynamic(
  () => import('@/components/WhiteboardCanvas'),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="flex flex-col h-screen w-full overflow-hidden bg-gray-50 relative">
      <Header />
      <Toolbar />
      <div className="flex-1 w-full h-full">
        <WhiteboardCanvas />
      </div>
    </main>
  );
}
