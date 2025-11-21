import { create } from 'zustand'
import { temporal, type TemporalState } from 'zundo'

export type ToolType = "pen" | "highlighter" | "eraser" | "rectangle" | "circle" | "line" | "arrow";
export type ShapeType = "rectangle" | "circle" | "line" | "arrow";

export interface Point {
    x: number;
    y: number;
}

export interface Stroke {
    id: string;
    tool: ToolType;
    points: Point[];
    color: string;
    width: number;
    opacity: number;
    pageId: string;
    createdAt: string;
    shapeType?: ShapeType; // For shape tools
}

interface WhiteboardState {
    currentTool: ToolType;
    currentColor: string;
    currentWidth: number;
    currentOpacity: number;
    strokes: Stroke[];
    activeStrokes: Map<string, Stroke>; // Map of touchId -> active stroke

    setTool: (tool: ToolType) => void;
    setColor: (color: string) => void;
    setWidth: (width: number) => void;
    setOpacity: (opacity: number) => void;

    startStroke: (point: Point, touchId?: string) => void;
    addPointToStroke: (point: Point, touchId?: string) => void;
    endStroke: (touchId?: string) => void;
    clearPage: () => void;
}

export const useWhiteboardStore = create<WhiteboardState>()(
    temporal((set, get) => ({
        currentTool: 'pen',
        currentColor: '#000000',
        currentWidth: 5,
        currentOpacity: 1,
        strokes: [],
        activeStrokes: new Map(),

        setTool: (tool) => {
            set({
                currentTool: tool,
                currentOpacity: tool === 'highlighter' ? 0.5 : 1
            })
        },
        setColor: (color) => set({ currentColor: color }),
        setWidth: (width) => set({ currentWidth: width }),
        setOpacity: (opacity) => set({ currentOpacity: opacity }),

        startStroke: (point, touchId = 'mouse') => {
            const { currentTool, currentColor, currentWidth, currentOpacity, activeStrokes } = get();
            const id = crypto.randomUUID();

            const isShapeTool = ['rectangle', 'circle', 'line', 'arrow'].includes(currentTool);

            const newStroke: Stroke = {
                id,
                tool: currentTool,
                points: [point],
                color: currentColor,
                width: currentWidth,
                opacity: currentOpacity,
                pageId: 'default',
                createdAt: new Date().toISOString(),
                ...(isShapeTool && { shapeType: currentTool as ShapeType }),
            };

            const newActiveStrokes = new Map(activeStrokes);
            newActiveStrokes.set(touchId, newStroke);

            set({
                activeStrokes: newActiveStrokes,
            });
        },

        addPointToStroke: (point, touchId = 'mouse') => {
            const { activeStrokes } = get();
            const activeStroke = activeStrokes.get(touchId);
            if (!activeStroke) return;

            const newActiveStrokes = new Map(activeStrokes);
            newActiveStrokes.set(touchId, {
                ...activeStroke,
                points: [...activeStroke.points, point],
            });

            set({
                activeStrokes: newActiveStrokes,
            });
        },

        endStroke: (touchId = 'mouse') => {
            const { activeStrokes } = get();
            const activeStroke = activeStrokes.get(touchId);

            if (activeStroke) {
                const newActiveStrokes = new Map(activeStrokes);
                newActiveStrokes.delete(touchId);

                set((state) => ({
                    strokes: [...state.strokes, activeStroke],
                    activeStrokes: newActiveStrokes,
                }));
            }
        },

        clearPage: () => {
            set({ strokes: [], activeStrokes: new Map() });
        },
    }), {
        partialize: (state) => ({
            strokes: state.strokes
        }),
        equality: (pastState, currentState) => {
            // Only create a new history entry if the strokes array length changed
            // This prevents intermediate drawing updates (addPointToStroke) from being tracked
            return pastState.strokes.length === currentState.strokes.length;
        }
    })
);
