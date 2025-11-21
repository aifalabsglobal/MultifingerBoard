'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Line, Rect, Ellipse, Arrow } from 'react-konva';
import { useWhiteboardStore, type Stroke } from '@/store/whiteboardStore';
import { KonvaEventObject } from 'konva/lib/Node';

export default function WhiteboardCanvas() {
    const {
        strokes,
        activeStrokes,
        startStroke,
        addPointToStroke,
        endStroke,
    } = useWhiteboardStore();

    const isDrawing = useRef<Set<string>>(new Set());
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

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

    // Mouse events (single point)
    const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
        isDrawing.current.add('mouse');
        const pos = e.target.getStage()?.getPointerPosition();
        if (pos) {
            startStroke({ x: pos.x, y: pos.y }, 'mouse');
        }
    };

    const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
        if (!isDrawing.current.has('mouse')) return;
        const pos = e.target.getStage()?.getPointerPosition();
        if (pos) {
            addPointToStroke({ x: pos.x, y: pos.y }, 'mouse');
        }
    };

    const handleMouseUp = () => {
        isDrawing.current.delete('mouse');
        endStroke('mouse');
    };

    // Touch events (multi-point)
    const handleTouchStart = (e: KonvaEventObject<TouchEvent>) => {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        if (!stage) return;

        const touches = e.evt.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            const touchId = `touch-${touch.identifier}`;
            isDrawing.current.add(touchId);

            const pos = stage.getPointerPosition();
            if (pos) {
                // Get the actual touch position relative to the stage
                const stageBox = stage.container().getBoundingClientRect();
                const x = touch.clientX - stageBox.left;
                const y = touch.clientY - stageBox.top;
                startStroke({ x, y }, touchId);
            }
        }
    };

    const handleTouchMove = (e: KonvaEventObject<TouchEvent>) => {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        if (!stage) return;

        const touches = e.evt.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const touch = touches[i];
            const touchId = `touch-${touch.identifier}`;

            if (!isDrawing.current.has(touchId)) continue;

            const stageBox = stage.container().getBoundingClientRect();
            const x = touch.clientX - stageBox.left;
            const y = touch.clientY - stageBox.top;
            addPointToStroke({ x, y }, touchId);
        }
    };

    const handleTouchEnd = (e: KonvaEventObject<TouchEvent>) => {
        e.evt.preventDefault();
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
        const compositeOp = (stroke.tool === 'eraser' ? 'destination-out' : 'source-over') as globalThis.GlobalCompositeOperation;

        const commonProps = {
            key: stroke.id,
            stroke: stroke.color,
            strokeWidth: stroke.width,
            opacity: stroke.opacity,
            globalCompositeOperation: compositeOp,
        };

        if (!stroke.shapeType || stroke.points.length < 2) {
            // Regular line/pen stroke
            return (
                <Line
                    {...commonProps}
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
                        points={[start.x, start.y, end.x, end.y]}
                        lineCap="round"
                    />
                );
            case 'arrow':
                return (
                    <Arrow
                        {...commonProps}
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
        <div ref={containerRef} className="w-full h-full bg-white touch-none">
            <Stage
                width={stageSize.width}
                height={stageSize.height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <Layer>
                    {strokes.map(renderStroke)}
                    {activeStrokesArray.map(renderStroke)}
                </Layer>
            </Stage>
        </div>
    );
}
