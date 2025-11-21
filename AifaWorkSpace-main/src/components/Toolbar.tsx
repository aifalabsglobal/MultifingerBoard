'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useStore } from 'zustand';
import { useWhiteboardStore, type Stroke } from '@/store/whiteboardStore';
import {
    MousePointer2,
    Pencil,
    Highlighter,
    Eraser,
    Square,
    Circle,
    Minus,
    MoveUpRight,
    Download,
    Type,
    Upload,
    FileJson,
    History,
    Palette,
    Undo2,
    Redo2,
    Trash2,
} from 'lucide-react';

const COLORS = [
    '#000000', // Black
    '#EF4444', // Red
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#8B5CF6', // Purple
];

const isValidPoint = (value: unknown): value is { x: number; y: number } =>
    Boolean(
        value &&
        typeof value === 'object' &&
        typeof (value as { x?: unknown }).x === 'number' &&
        typeof (value as { y?: unknown }).y === 'number'
    );

const isValidStroke = (value: unknown): value is Stroke => {
    if (!value || typeof value !== 'object') return false;
    const stroke = value as Partial<Stroke>;
    const hasPoints = Array.isArray(stroke.points) && stroke.points.every(isValidPoint);
    return (
        typeof stroke.id === 'string' &&
        typeof stroke.tool === 'string' &&
        typeof stroke.color === 'string' &&
        typeof stroke.width === 'number' &&
        typeof stroke.opacity === 'number' &&
        typeof stroke.pageId === 'string' &&
        typeof stroke.createdAt === 'string' &&
        hasPoints
    );
};

export default function Toolbar() {
    const {
        currentTool,
        currentColor,
        currentWidth,
        setTool,
        setColor,
        setWidth,
        clearPage,
        strokes,
        replaceStrokes,
    } = useWhiteboardStore();

    const { undo, redo, pastStates, futureStates } = useStore(
        useWhiteboardStore.temporal,
        (state) => ({
            undo: state.undo,
            redo: state.redo,
            pastStates: state.pastStates,
            futureStates: state.futureStates,
        })
    );

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [expandedSection, setExpandedSection] = useState<string | null>(null);

    const canUndo = pastStates.length > 0;
    const canRedo = futureStates.length > 0;

    const handleExportClick = useCallback(() => {
        if (typeof window === 'undefined') return;
        const exportCanvas = window.exportCanvas;
        if (typeof exportCanvas === 'function') {
            exportCanvas('png');
        }
    }, []);

    const handleExportBoard = useCallback(() => {
        if (!strokes.length) {
            window.alert('Nothing to export yet.');
            return;
        }
        const payload = JSON.stringify(strokes, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `whiteboard-${new Date().toISOString()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }, [strokes]);

    const handleImportBoard = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const text = reader.result;
                    if (typeof text !== 'string') {
                        throw new Error('Invalid file format.');
                    }
                    const parsed = JSON.parse(text);
                    if (!Array.isArray(parsed)) {
                        throw new Error('JSON must be an array of strokes.');
                    }

                    const sanitized = parsed.filter(isValidStroke) as Stroke[];
                    if (!sanitized.length) {
                        throw new Error('No valid strokes found in file.');
                    }
                    replaceStrokes(sanitized);
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unable to import board.';
                    window.alert(message);
                } finally {
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                }
            };
            reader.readAsText(file);
        },
        [replaceStrokes]
    );

    const triggerImportDialog = () => {
        fileInputRef.current?.click();
    };

    type ToolConfig = {
        id: string;
        icon: React.ComponentType<{ size?: number }>;
        label: string;
        value?: string;
        action?: () => void;
    };

    const drawTools: ToolConfig[] = [
        { id: 'pen', icon: Pencil, label: 'Pen', value: 'pen' },
        { id: 'highlighter', icon: Highlighter, label: 'Highlighter', value: 'highlighter' },
        { id: 'eraser', icon: Eraser, label: 'Eraser', value: 'eraser' },
        { id: 'text', icon: Type, label: 'Text', value: 'text' },
    ];

    const shapeTools: ToolConfig[] = [
        { id: 'rectangle', icon: Square, label: 'Rectangle', value: 'rectangle' },
        { id: 'circle', icon: Circle, label: 'Circle', value: 'circle' },
        { id: 'line', icon: Minus, label: 'Line', value: 'line' },
        { id: 'arrow', icon: MoveUpRight, label: 'Arrow', value: 'arrow' },
    ];

    const renderExpandedPanel = () => {
        if (expandedSection === 'draw') {
            return (
                <div className="absolute left-full ml-2 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3 space-y-2 min-w-[200px]">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">Draw</p>
                    {drawTools.map((tool) => {
                        const Icon = tool.icon;
                        return (
                            <button
                                key={tool.id}
                                onClick={() => tool.value && setTool(tool.value)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${currentTool === tool.value
                                    ? 'bg-blue-50 text-blue-600 font-medium'
                                    : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <Icon size={18} />
                                <span>{tool.label}</span>
                            </button>
                        );
                    })}
                </div>
            );
        }

        if (expandedSection === 'shapes') {
            return (
                <div className="absolute left-full ml-2 bg-white rounded-2xl shadow-2xl border border-gray-200 p-3 space-y-2 min-w-[200px]">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">Shapes</p>
                    {shapeTools.map((tool) => {
                        const Icon = tool.icon;
                        return (
                            <button
                                key={tool.id}
                                onClick={() => tool.value && setTool(tool.value)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all ${currentTool === tool.value
                                    ? 'bg-blue-50 text-blue-600 font-medium'
                                    : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <Icon size={18} />
                                <span>{tool.label}</span>
                            </button>
                        );
                    })}
                </div>
            );
        }

        if (expandedSection === 'style') {
            return (
                <div className="absolute left-full ml-2 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 space-y-4 min-w-[240px]">
                    <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Color</p>
                        <div className="flex flex-wrap gap-2">
                            {COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => setColor(color)}
                                    className={`w-8 h-8 rounded-full border-2 transition-all ${currentColor === color
                                        ? 'scale-110 border-blue-500 shadow-md'
                                        : 'border-gray-200 hover:scale-105'
                                        }`}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                            <label className="w-8 h-8 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer text-xs text-gray-500 hover:bg-gray-50">
                                +
                                <input
                                    type="color"
                                    value={currentColor}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="sr-only"
                                />
                            </label>
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                            <span className="font-semibold text-gray-400 uppercase tracking-wider">Width</span>
                            <span className="font-medium text-gray-700">{currentWidth}px</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="30"
                            value={currentWidth}
                            onChange={(e) => setWidth(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <>
            <div className="fixed left-4 top-1/2 -translate-y-1/2 z-50">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-2 flex flex-col gap-1">
                    {/* Pointer Tool */}
                    <button
                        onClick={() => setTool('select')}
                        className={`group relative p-3 rounded-xl transition-all ${currentTool === 'select'
                            ? 'bg-blue-50 text-blue-600'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        title="Pointer"
                    >
                        <MousePointer2 size={20} />
                    </button>

                    <div className="h-px bg-gray-200 my-1" />

                    {/* Draw Tools */}
                    <div
                        className="relative"
                        onMouseEnter={() => setExpandedSection('draw')}
                        onMouseLeave={() => setExpandedSection(null)}
                    >
                        <button
                            className={`p-3 rounded-xl transition-all ${['pen', 'highlighter', 'eraser', 'text'].includes(currentTool)
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                            title="Draw"
                        >
                            <Pencil size={20} />
                        </button>
                        {expandedSection === 'draw' && renderExpandedPanel()}
                    </div>

                    {/* Shape Tools */}
                    <div
                        className="relative"
                        onMouseEnter={() => setExpandedSection('shapes')}
                        onMouseLeave={() => setExpandedSection(null)}
                    >
                        <button
                            className={`p-3 rounded-xl transition-all ${['rectangle', 'circle', 'line', 'arrow'].includes(currentTool)
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                            title="Shapes"
                        >
                            <Square size={20} />
                        </button>
                        {expandedSection === 'shapes' && renderExpandedPanel()}
                    </div>

                    {/* Style */}
                    <div
                        className="relative"
                        onMouseEnter={() => setExpandedSection('style')}
                        onMouseLeave={() => setExpandedSection(null)}
                    >
                        <button
                            className="p-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-all"
                            title="Style"
                        >
                            <Palette size={20} />
                        </button>
                        {expandedSection === 'style' && renderExpandedPanel()}
                    </div>

                    <div className="h-px bg-gray-200 my-1" />

                    {/* Undo / Redo */}
                    <button
                        onClick={() => undo()}
                        disabled={!canUndo}
                        className={`p-3 rounded-xl transition-all ${!canUndo
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        title="Undo"
                    >
                        <Undo2 size={20} />
                    </button>

                    <button
                        onClick={() => redo()}
                        disabled={!canRedo}
                        className={`p-3 rounded-xl transition-all ${!canRedo
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                        title="Redo"
                    >
                        <Redo2 size={20} />
                    </button>

                    <div className="h-px bg-gray-200 my-1" />

                    {/* Export / Import */}
                    <button
                        onClick={handleExportClick}
                        className="p-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-all"
                        title="Export as PNG"
                    >
                        <Download size={20} />
                    </button>

                    <button
                        onClick={handleExportBoard}
                        className="p-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-all"
                        title="Export as JSON"
                    >
                        <FileJson size={20} />
                    </button>

                    <button
                        onClick={triggerImportDialog}
                        className="p-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-all"
                        title="Import Board"
                    >
                        <Upload size={20} />
                    </button>

                    <div className="h-px bg-gray-200 my-1" />

                    {/* Clear */}
                    <button
                        onClick={clearPage}
                        className="p-3 rounded-xl text-red-600 hover:bg-red-50 transition-all"
                        title="Clear Board"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleImportBoard}
            />
        </>
    );
}
