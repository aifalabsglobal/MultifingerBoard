'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Plus, Layout, FolderOpen } from 'lucide-react';

type Board = {
    id: string;
    title: string;
    updatedAt: string;
};

type Workspace = {
    id: string;
    name: string;
    boards: Board[];
};

export default function WorkspaceSelector({ currentBoardId }: { currentBoardId?: string }) {
    const router = useRouter();
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [showNewBoardInput, setShowNewBoardInput] = useState<string | null>(null);
    const [newBoardName, setNewBoardName] = useState('');

    useEffect(() => {
        fetchWorkspaces();
    }, []);

    const fetchWorkspaces = async () => {
        try {
            const res = await fetch('/api/workspaces');
            const data = await res.json();
            if (data.workspaces) {
                setWorkspaces(data.workspaces);
            }
        } catch (error) {
            console.error('Failed to load workspaces:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBoard = async (workspaceId: string) => {
        if (!newBoardName.trim()) return;

        try {
            const res = await fetch('/api/workspaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newBoardName,
                    workspaceId,
                }),
            });
            const data = await res.json();
            if (data.board) {
                setNewBoardName('');
                setShowNewBoardInput(null);
                await fetchWorkspaces();
                router.push(`/board/${data.board.id}`);
                setIsOpen(false);
            }
        } catch (error) {
            console.error('Failed to create board:', error);
        }
    };

    const currentWorkspace = workspaces.find(w =>
        w.boards.some(b => b.id === currentBoardId)
    ) || workspaces[0];

    const currentBoard = currentWorkspace?.boards.find(b => b.id === currentBoardId);

    if (loading) return <div className="h-10 w-40 bg-gray-100 animate-pulse rounded-lg" />;

    return (
        <div className="relative z-50">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg shadow-sm transition-all text-sm font-medium text-gray-700"
            >
                <Layout size={16} className="text-blue-600" />
                <span className="max-w-[150px] truncate">
                    {currentBoard ? currentBoard.title : 'Select Board'}
                </span>
                <span className="text-gray-400 text-xs px-1.5 py-0.5 bg-gray-100 rounded-md truncate max-w-[100px]">
                    {currentWorkspace?.name}
                </span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 max-h-[80vh] overflow-y-auto z-50 p-2">
                        {workspaces.map((workspace) => (
                            <div key={workspace.id} className="mb-4 last:mb-0">
                                <div className="flex items-center justify-between px-2 py-1.5 mb-1">
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <FolderOpen size={12} />
                                        {workspace.name}
                                    </span>
                                    <button
                                        onClick={() => setShowNewBoardInput(showNewBoardInput === workspace.id ? null : workspace.id)}
                                        className="p-1 hover:bg-blue-50 text-gray-400 hover:text-blue-600 rounded transition-colors"
                                        title="New Board"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>

                                {showNewBoardInput === workspace.id && (
                                    <div className="px-2 mb-2">
                                        <div className="flex gap-1">
                                            <input
                                                type="text"
                                                value={newBoardName}
                                                onChange={(e) => setNewBoardName(e.target.value)}
                                                placeholder="Board name..."
                                                className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                                                autoFocus
                                                onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard(workspace.id)}
                                            />
                                            <button
                                                onClick={() => handleCreateBoard(workspace.id)}
                                                className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-0.5">
                                    {workspace.boards.map((board) => (
                                        <button
                                            key={board.id}
                                            onClick={() => {
                                                router.push(`/board/${board.id}`);
                                                setIsOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group ${currentBoardId === board.id
                                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                                    : 'text-gray-600 hover:bg-gray-50'
                                                }`}
                                        >
                                            <span className="truncate">{board.title}</span>
                                            {currentBoardId === board.id && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                            )}
                                        </button>
                                    ))}
                                    {workspace.boards.length === 0 && (
                                        <div className="px-3 py-2 text-xs text-gray-400 italic">
                                            No boards yet
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
