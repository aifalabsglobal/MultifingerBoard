'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Line, Rect, Ellipse, Arrow, Text } from 'react-konva';
import { useWhiteboardStore, type Stroke, type Point } from '@/store/whiteboardStore';
import { KonvaEventObject } from 'konva/lib/Node';
import type { Stage as KonvaStage } from 'konva/lib/Stage';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

type ExportFormat = 'png' | 'pdf' | 'svg';

const MIN_SCALE = 0.25;
const MAX_SCALE = 3;
const SCALE_STEP = 1.05;
const GRID_SIZE = 40;

declare global {
    interface Window {
        exportCanvas?: (format: ExportFormat) => void;
    }
}

interface WhiteboardCanvasProps {
    boardId?: string;
}

export default function WhiteboardCanvas({ boardId }: WhiteboardCanvasProps) {
    const {
        strokes,
        activeStrokes,
        startStroke,
        addPointToStroke,
        endStroke,
        currentTool,
        addText,
        setStageRef,
        selectedStrokeId,
        selectStroke,
        replaceStrokes,
    } = useWhiteboardStore();

    const stageRef = useRef<KonvaStage | null>(null);
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
    const lastSavedStrokes = useRef<string>('[]');

    // Load board data
    useEffect(() => {
        if (!boardId) return;

        const loadBoard = async () => {
            try {
                const res = await fetch(`/api/boards/${boardId}`);
                if (!res.ok) throw new Error('Failed to load board');
                const data = await res.json();
                if (Array.isArray(data.content)) {
                    replaceStrokes(data.content);
                    lastSavedStrokes.current = JSON.stringify(data.content);
                }
            } catch (error) {
                console.error('Error loading board:', error);
            }
        };

        loadBoard();
    }, [boardId, replaceStrokes]);

    // Auto-save logic
    useEffect(() => {
        if (!boardId) return;

        const currentStrokesStr = JSON.stringify(strokes);
        if (currentStrokesStr === lastSavedStrokes.current) return;

        setSaveStatus('saving');
        const timeoutId = setTimeout(async () => {
            try {
                const res = await fetch(`/api/boards/${boardId}/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: strokes }),
                });

                if (!res.ok) throw new Error('Failed to save');

                lastSavedStrokes.current = currentStrokesStr;
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus(null), 2000);
            } catch (error) {
                console.error('Error saving board:', error);
                setSaveStatus('error');
            }
        }, 2000); // Debounce save by 2 seconds

        return () => clearTimeout(timeoutId);
    }, [strokes, boardId]);

    // Export canvas as PNG, PDF, or SVG
    const exportCanvas = useCallback((format: ExportFormat) => {
        if (!stageRef.current) return;
        if (format === 'png') {
            const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = 'whiteboard.png';
            link.href = dataURL;
            link.click();
        } else if (format === 'svg') {
            // SVG export not currently supported in this version of Konva
            // Fallback to PNG export
            const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = 'whiteboard.png';
            link.href = dataURL;
            link.click();
        } else if (format === 'pdf') {
            // Simple PDF export using jsPDF (add as dependency if not present)
            import('jspdf').then(({ jsPDF }) => {
                if (!stageRef.current) return;
                const imgData = stageRef.current.toDataURL({ pixelRatio: 2 });
                const pdf = new jsPDF({ orientation: 'landscape' });
                pdf.addImage(imgData, 'PNG', 10, 10, 280, 150);
                pdf.save('whiteboard.pdf');
            });
        }
    }, []);

    // expose export function globally for toolbar button
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        window.exportCanvas = exportCanvas;
        return () => {
            if (window.exportCanvas === exportCanvas) {
                delete window.exportCanvas;
            }
        };
    }, [exportCanvas]);

    // Set the stage reference in the store for external use (e.g., export)
    useEffect(() => {
        setStageRef(stageRef.current);
        return () => setStageRef(null);
    }, [setStageRef]);

    const isDrawing = useRef<Set<string>>(new Set());
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const [stageTransform, setStageTransform] = useState({ scale: 1, x: 0, y: 0 });
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const panOrigin = useRef<{ x: number; y: number; stageX: number; stageY: number } | null>(null);
    const pinchState = useRef<{
        initialDistance: number;
        initialScale: number;
        centerScene: Point;
    } | null>(null);
    const isSelectionMode = currentTool === 'select';
    const zoomPercentage = Math.round(stageTransform.scale * 100);

    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setStageSize({
                    width: containerRef.current.offsetWidth,
                    height: containerRef.current.offsetHeight,
                });
            }
        };

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code === 'Space') {
                event.preventDefault();
                setIsSpacePressed(true);
            }
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.code === 'Space') {
                event.preventDefault();
                setIsSpacePressed(false);
                setIsPanning(false);
                panOrigin.current = null;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    useEffect(() => {
        const container = stageRef.current?.container();
        if (!container) return;
        if (isPanning) {
            container.style.cursor = 'grabbing';
        } else if (isSpacePressed) {
            container.style.cursor = 'grab';
        } else if (isSelectionMode) {
            container.style.cursor = 'default';
        } else {
            container.style.cursor = 'crosshair';
        }
    }, [isPanning, isSpacePressed, isSelectionMode]);

    useEffect(() => {
        if (!isSelectionMode) {
            pinchState.current = null;
        }
    }, [isSelectionMode]);

    const clientToScenePoint = useCallback(
        (clientX: number, clientY: number, transform = stageTransform): Point | null => {
            const stage = stageRef.current;
            if (!stage) return null;
            const box = stage.container().getBoundingClientRect();
            const pointer = {
                x: clientX - box.left,
                y: clientY - box.top,
            };
            return {
                x: (pointer.x - transform.x) / transform.scale,
                y: (pointer.y - transform.y) / transform.scale,
            };
        },
        [stageTransform]
    );

    const clampScale = useCallback((value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value)), []);

    const handleWheel = useCallback(
        (event: KonvaEventObject<WheelEvent>) => {
            event.evt.preventDefault();
            const stage = stageRef.current;
            if (!stage) return;
            const pointer = stage.getPointerPosition();
            if (!pointer) return;

            const direction = event.evt.deltaY > 0 ? -1 : 1;

            setStageTransform((prev) => {
                const nextScale = clampScale(prev.scale * (direction > 0 ? SCALE_STEP : 1 / SCALE_STEP));
                const mousePoint = {
                    x: (pointer.x - prev.x) / prev.scale,
                    y: (pointer.y - prev.y) / prev.scale,
                };

                return {
                    scale: nextScale,
                    x: pointer.x - mousePoint.x * nextScale,
                    y: pointer.y - mousePoint.y * nextScale,
                };
            });
        },
        [clampScale]
    );

    const beginPan = useCallback(
        (clientX: number, clientY: number) => {
            setIsPanning(true);
            panOrigin.current = { x: clientX, y: clientY, stageX: stageTransform.x, stageY: stageTransform.y };
        },
        [stageTransform]
    );

    const zoomByStep = useCallback(
        (direction: 'in' | 'out') => {
            const pointer = {
                x: stageSize.width / 2,
                y: stageSize.height / 2,
            };

            setStageTransform((prev) => {
                const nextScale = clampScale(prev.scale * (direction === 'in' ? SCALE_STEP : 1 / SCALE_STEP));
                const scenePoint = {
                    x: (pointer.x - prev.x) / prev.scale,
                    y: (pointer.y - prev.y) / prev.scale,
                };

                return {
                    scale: nextScale,
                    x: pointer.x - scenePoint.x * nextScale,
                    y: pointer.y - scenePoint.y * nextScale,
                };
            });
        },
        [clampScale, stageSize.height, stageSize.width]
    );

    const resetView = useCallback(() => {
        setStageTransform({ scale: 1, x: 0, y: 0 });
    }, []);

    // Mouse events (single point)
    const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
        if (isSpacePressed || e.evt.button === 1) {
            beginPan(e.evt.clientX, e.evt.clientY);
            return;
        }

        if (isSelectionMode) {
            const clickedOnEmpty = e.target === e.target.getStage();
            if (clickedOnEmpty) {
                selectStroke(null);
            }
            return;
        }

        const pos = clientToScenePoint(e.evt.clientX, e.evt.clientY);
        if (!pos) return;
        if (currentTool === 'text') {
            const txt = window.prompt('Enter text');
            if (txt) {
                addText(txt, { x: pos.x, y: pos.y });
            }
            return;
        }
        isDrawing.current.add('mouse');
        startStroke({ x: pos.x, y: pos.y }, 'mouse');
    };

    const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
        if (isPanning && panOrigin.current) {
            const origin = panOrigin.current;
            const dx = e.evt.clientX - origin.x;
            const dy = e.evt.clientY - origin.y;
            setStageTransform((prev) => ({
                ...prev,
                x: origin.stageX + dx,
                y: origin.stageY + dy,
            }));
            return;
        }

        if (isSelectionMode) return;

        if (!isDrawing.current.has('mouse')) return;
        const pos = clientToScenePoint(e.evt.clientX, e.evt.clientY);
        if (pos) {
            addPointToStroke({ x: pos.x, y: pos.y }, 'mouse');
        }
    };

    const handleMouseUp = () => {
        if (isSelectionMode) {
            return;
        }
        if (isPanning) {
            setIsPanning(false);
            panOrigin.current = null;
            return;
        }
        isDrawing.current.delete('mouse');
        endStroke('mouse');
    };

    // Touch events (multi-point)
    const handleTouchStart = (e: KonvaEventObject<TouchEvent>) => {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        if (!stage) return;

        const shouldUsePinch = isSelectionMode && e.evt.touches.length >= 2;
        if (shouldUsePinch) {
            const touch1 = e.evt.touches[0];
            const touch2 = e.evt.touches[1];
            const initialDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            const centerClientX = (touch1.clientX + touch2.clientX) / 2;
            const centerClientY = (touch1.clientY + touch2.clientY) / 2;
            const centerScene = clientToScenePoint(centerClientX, centerClientY);
            if (centerScene) {
                pinchState.current = {
                    initialDistance,
                    initialScale: stageTransform.scale,
                    centerScene,
                };
            }
            return;
        }

        if (isSelectionMode) {
            const tappedOnEmpty = e.target === stage;
            if (tappedOnEmpty) {
                selectStroke(null);
            }
            return;
        }

        const touches = e.evt.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            const touchId = `touch-${touch.identifier}`;
            isDrawing.current.add(touchId);

            const point = clientToScenePoint(touch.clientX, touch.clientY);
            if (point) {
                startStroke(point, touchId);
            }
        }
    };

    const handleTouchMove = (e: KonvaEventObject<TouchEvent>) => {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        if (!stage) return;

        if (pinchState.current && isSelectionMode && e.evt.touches.length >= 2) {
            const touch1 = e.evt.touches[0];
            const touch2 = e.evt.touches[1];
            const distance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            const centerClientX = (touch1.clientX + touch2.clientX) / 2;
            const centerClientY = (touch1.clientY + touch2.clientY) / 2;

            const pinch = pinchState.current;
            if (!pinch || pinch.initialDistance === 0) {
                return;
            }

            const nextScale = clampScale(
                (distance / pinch.initialDistance) * pinch.initialScale
            );

            const stageNode = stageRef.current;
            if (!stageNode) return;
            const box = stageNode.container().getBoundingClientRect();
            const centerPointer = {
                x: centerClientX - box.left,
                y: centerClientY - box.top,
            };

            setStageTransform({
                scale: nextScale,
                x: centerPointer.x - pinch.centerScene.x * nextScale,
                y: centerPointer.y - pinch.centerScene.y * nextScale,
            });
            return;
        }

        if (isSelectionMode) {
            return;
        }

        const touches = e.evt.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            const touchId = `touch-${touch.identifier}`;

            if (!isDrawing.current.has(touchId)) continue;

            const point = clientToScenePoint(touch.clientX, touch.clientY);
            if (point) {
                addPointToStroke(point, touchId);
            }
        }
    };

    const handleTouchEnd = (e: KonvaEventObject<TouchEvent>) => {
        e.evt.preventDefault();

        if (pinchState.current && e.evt.touches.length < 2) {
            pinchState.current = null;
        }

        if (isSelectionMode) {
            return;
        }

        const touches = e.evt.changedTouches;

        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            const touchId = `touch-${touch.identifier}`;
            isDrawing.current.delete(touchId);
            endStroke(touchId);
        }
    };

    // Convert activeStrokes Map to array for rendering
    const activeStrokesArray = Array.from(activeStrokes.values());

    // Helper function to render a stroke (line or shape)
    const renderStroke = (stroke: Stroke) => {
        const isSelectedStroke = stroke.id === selectedStrokeId;
        const selectionStyles = isSelectedStroke
            ? {
                shadowColor: '#2563eb',
                shadowBlur: 12,
                shadowOpacity: 0.8,
            }
            : {};
        const selectionHandlers = {
            onMouseDown: (event: KonvaEventObject<MouseEvent>) => {
                if (!isSelectionMode) return;
                event.cancelBubble = true;
                selectStroke(stroke.id);
            },
            onTouchStart: (event: KonvaEventObject<TouchEvent>) => {
                if (!isSelectionMode) return;
                event.cancelBubble = true;
                selectStroke(stroke.id);
            },
        };
        const compositeOp = (stroke.tool === 'eraser' ? 'destination-out' : 'source-over') as globalThis.GlobalCompositeOperation;

        const commonProps = {
            key: stroke.id,
            stroke: stroke.color,
            strokeWidth: stroke.width,
            opacity: stroke.opacity,
            globalCompositeOperation: compositeOp,
            ...selectionStyles,
        };

        if (stroke.tool === 'text' && stroke.text) {
            const { x, y } = stroke.points[0] ?? { x: 0, y: 0 };
            return (
                <Text
                    key={stroke.id}
                    text={stroke.text}
                    x={x}
                    y={y}
                    fontSize={Math.max(stroke.width * 4, 12)}
                    fill={stroke.color}
                    opacity={stroke.opacity}
                    {...selectionStyles}
                    {...selectionHandlers}
                />
            );
        }

        if (!stroke.shapeType || stroke.points.length < 2) {
            // Regular line/pen stroke
            return (
                <Line
                    {...commonProps}
                    {...selectionHandlers}
                    points={stroke.points.flatMap((p) => [p.x, p.y])}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                />
            );
        }

        // Shape rendering
        const start = stroke.points[0];
        const end = stroke.points[stroke.points.length - 1];
        const width = end.x - start.x;
        const height = end.y - start.y;

        switch (stroke.shapeType) {
            case 'rectangle':
                return (
                    <Rect
                        {...commonProps}
                        {...selectionHandlers}
                        x={Math.min(start.x, end.x)}
                        y={Math.min(start.y, end.y)}
                        width={Math.abs(width)}
                        height={Math.abs(height)}
                    />
                );
            case 'circle':
                return (
                    <Ellipse
                        {...commonProps}
                        {...selectionHandlers}
                        x={start.x + width / 2}
                        y={start.y + height / 2}
                        radiusX={Math.abs(width) / 2}
                        radiusY={Math.abs(height) / 2}
                    />
                );
            case 'line':
                return (
                    <Line
                        {...commonProps}
                        {...selectionHandlers}
                        points={[start.x, start.y, end.x, end.y]}
                        lineCap="round"
                    />
                );
            case 'arrow':
                return (
                    <Arrow
                        {...commonProps}
                        {...selectionHandlers}
                        points={[start.x, start.y, end.x, end.y]}
                        pointerLength={15}
                        pointerWidth={15}
                        fill={stroke.color}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full touch-none"
            style={{
                backgroundColor: '#f8fafc',
                backgroundImage: `
                    linear-gradient(90deg, rgba(99,102,241,0.08) 1px, transparent 0),
                    linear-gradient(180deg, rgba(99,102,241,0.08) 1px, transparent 0)
                `,
                backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            }}
        >
            <Stage
                ref={stageRef}
                width={stageSize.width}
                height={stageSize.height}
                scaleX={stageTransform.scale}
                scaleY={stageTransform.scale}
                x={stageTransform.x}
                y={stageTransform.y}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ backgroundColor: 'transparent' }}
            >
                <Layer>
                    {strokes.map(renderStroke)}
                    {activeStrokesArray.map(renderStroke)}
                </Layer>
            </Stage>

            {/* Save Status Indicator */}
            {saveStatus && (
                <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-white/90 rounded-full shadow-sm text-xs font-medium transition-all">
                    {saveStatus === 'saving' && (
                        <>
                            <Loader2 size={14} className="animate-spin text-blue-500" />
                            <span className="text-gray-600">Saving...</span>
                        </>
                    )}
                    {saveStatus === 'saved' && (
                        <>
                            <CheckCircle2 size={14} className="text-green-500" />
                            <span className="text-gray-600">Saved</span>
                        </>
                    )}
                    {saveStatus === 'error' && (
                        <>
                            <AlertCircle size={14} className="text-red-500" />
                            <span className="text-red-600">Save failed</span>
                        </>
                    )}
                </div>
            )}

            <div className="absolute bottom-6 right-6 flex flex-col items-center gap-2 z-50">
                <div className="bg-white/90 text-xs font-semibold text-gray-700 px-3 py-1 rounded-full shadow">
                    {zoomPercentage}%
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl shadow flex flex-col overflow-hidden">
                    <button
                        type="button"
                        onClick={() => zoomByStep('in')}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        title="Zoom In"
                    >
                        +
                    </button>
                    <button
                        type="button"
                        onClick={() => zoomByStep('out')}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border-t border-b border-gray-100 transition-colors"
                        title="Zoom Out"
                    >
                        -
                    </button>
                    <button
                        type="button"
                        onClick={resetView}
                        className="px-4 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Reset View"
                    >
                        Reset
                    </button>
                </div>
            </div>
        </div>
    );
}
