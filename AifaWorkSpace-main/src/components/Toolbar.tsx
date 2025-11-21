'use client';

import React from 'react';
import { useStore } from 'zustand';
import { useWhiteboardStore } from '@/store/whiteboardStore';
import {
    Pencil,
    Highlighter,
    Eraser,
    Undo2,
    Redo2,
    Trash2
} from 'lucide-react';

const COLORS = [
    '#000000', // Black
    '#EF4444', // Red
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#8B5CF6', // Purple
];

export default function Toolbar() {
    const {
        currentTool,
        currentColor,
        currentWidth,
        setTool,
        setColor,
        setWidth,
        clearPage,
    } = useWhiteboardStore();

    // Access temporal store for undo/redo - use useStore for reactivity
    const { undo, redo, pastStates, futureStates } = useStore(
        useWhiteboardStore.temporal,
        (state) => ({
            undo: state.undo,
            redo: state.redo,
            pastStates: state.pastStates,
            futureStates: state.futureStates,
        })
    );

    const canUndo = pastStates.length > 0;
    const canRedo = futureStates.length > 0;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-lg border border-gray-200 p-2 flex items-center gap-4 z-50">
            {/* Tools */}
            <div className="flex items-center gap-1 border-r border-gray-200 pr-4">
                <button
                    onClick={() => setTool('pen')}
                    className={`p-2 rounded-xl transition-colors ${currentTool === 'pen'
                        ? 'bg-blue-100 text-blue-600'
                        : 'hover:bg-gray-100 text-gray-600'
                        }`}
                    title="Pen"
                >
                    <Pencil size={20} />
                </button>
                <button
                    onClick={() => setTool('highlighter')}
                    className={`p-2 rounded-xl transition-colors ${currentTool === 'highlighter'
                        ? 'bg-blue-100 text-blue-600'
                        : 'hover:bg-gray-100 text-gray-600'
                        }`}
                    title="Highlighter"
                >
                    <Highlighter size={20} />
                </button>
                <button
                    onClick={() => setTool('eraser')}
                    className={`p-2 rounded-xl transition-colors ${currentTool === 'eraser'
                        ? 'bg-blue-100 text-blue-600'
                        : 'hover:bg-gray-100 text-gray-600'
                        }`}
                    title="Eraser"
                >
                    <Eraser size={20} />
                </button>
            </div>

            {/* Colors */}
            <div className="flex items-center gap-2 border-r border-gray-200 pr-4">
                {COLORS.map((color) => (
                    <button
                        key={color}
                        onClick={() => setColor(color)}
                        className={`w-6 h-6 rounded-full border transition-transform ${currentColor === color ? 'scale-125 border-gray-400' : 'border-transparent hover:scale-110'
                            }`}
                        style={{ backgroundColor: color }}
                        title={color}
                    />
                ))}
                <div className="relative w-6 h-6 rounded-full overflow-hidden border border-gray-200">
                    <input
                        type="color"
                        value={currentColor}
                        onChange={(e) => setColor(e.target.value)}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 cursor-pointer border-none"
                        title="Custom Color"
                    />
                </div>
            </div>

            {/* Width */}
            <div className="flex items-center gap-3 border-r border-gray-200 pr-4">
                {/* Preset Size Buttons */}
                <div className="flex gap-1">
                    <button
                        onClick={() => setWidth(3)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${currentWidth === 3 ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}
                        title="Small (3px)"
                    >
                        S
                    </button>
                    <button
                        onClick={() => setWidth(8)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${currentWidth === 8 ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}
                        title="Medium (8px)"
                    >
                        M
                    </button>
                    <button
                        onClick={() => setWidth(15)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${currentWidth === 15 ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}
                        title="Large (15px)"
                    >
                        L
                    </button>
                </div>

                {/* Width Slider */}
                <div className="flex items-center gap-2 w-32">
                    <input
                        type="range"
                        min="1"
                        max="30"
                        value={currentWidth}
                        onChange={(e) => setWidth(Number(e.target.value))}
                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        title="Stroke Width"
                    />
                </div>

                {/* Size Preview & Value */}
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 flex items-center justify-center">
                        <div
                            className="rounded-full bg-gray-600"
                            style={{
                                width: `${Math.min(currentWidth, 24)}px`,
                                height: `${Math.min(currentWidth, 24)}px`
                            }}
                            title={`Size: ${currentWidth}px`}
                        />
                    </div>
                    <span className="text-xs text-gray-500 font-medium w-6 text-center">{currentWidth}</span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => undo()}
                    disabled={!canUndo}
                    className={`p-2 rounded-xl transition-colors ${!canUndo ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-600'
                        }`}
                    title="Undo"
                >
                    <Undo2 size={20} />
                </button>
                <button
                    onClick={() => redo()}
                    disabled={!canRedo}
                    className={`p-2 rounded-xl transition-colors ${!canRedo ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100 text-gray-600'
                        }`}
                    title="Redo"
                >
                    <Redo2 size={20} />
                </button>
                <div className="w-px h-6 bg-gray-200 mx-1" />
                <button
                    onClick={clearPage}
                    className="p-2 rounded-xl hover:bg-red-50 text-red-500 transition-colors"
                    title="Clear Page"
                >
                    <Trash2 size={20} />
                </button>
            </div>
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-gray-400 whitespace-nowrap">
                History: {pastStates.length} / {futureStates.length}
            </div>
        </div>
    );
}
