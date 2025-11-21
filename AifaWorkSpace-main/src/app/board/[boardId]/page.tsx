'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import Toolbar from '@/components/Toolbar';
import UserMenu from '@/components/UserMenu';

// Dynamically import WhiteboardCanvas to avoid SSR issues with Konva
const WhiteboardCanvas = dynamic(() => import('@/components/WhiteboardCanvas'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-screen bg-slate-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    ),
});

export default function BoardPage() {
    const params = useParams();
    const boardId = params.boardId as string;
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <main className="relative w-full h-screen overflow-hidden bg-slate-50">
            {/* Top Bar */}
            <div className="absolute top-4 left-4 z-50 flex items-center gap-4">
                <WorkspaceSelector currentBoardId={boardId} />
            </div>

            {/* User Menu */}
            <div className="absolute top-4 right-4 z-50">
                <UserMenu />
            </div>

            {/* Toolbar */}
            <Toolbar />

            {/* Canvas */}
            <div className="absolute inset-0 z-0">
                <WhiteboardCanvas boardId={boardId} />
            </div>
        </main>
    );
}
