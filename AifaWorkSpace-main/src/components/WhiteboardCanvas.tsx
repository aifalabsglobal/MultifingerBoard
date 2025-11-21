'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { useWhiteboardStore } from '@/store/whiteboardStore';
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
                    {strokes.map((stroke) => (
                        <Line
                            key={stroke.id}
                            points={stroke.points.flatMap((p) => [p.x, p.y])}
                            stroke={stroke.color}
                            strokeWidth={stroke.width}
                            tension={0.5}
                            lineCap="round"
                            lineJoin="round"
                            opacity={stroke.opacity}
                            globalCompositeOperation={
                                stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
                            }
                        />
                    ))}
                    {activeStrokesArray.map((stroke) => (
                        <Line
                            key={stroke.id}
                            points={stroke.points.flatMap((p) => [p.x, p.y])}
                            stroke={stroke.color}
                            strokeWidth={stroke.width}
                            tension={0.5}
                            lineCap="round"
                            lineJoin="round"
                            opacity={stroke.opacity}
                            globalCompositeOperation={
                                stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
                            }
                        />
                    ))}
                </Layer>
            </Stage>
        </div>
    );
}
