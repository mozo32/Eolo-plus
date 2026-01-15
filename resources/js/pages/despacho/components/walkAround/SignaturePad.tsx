import React, { useEffect, useRef } from "react";
import Swal from "sweetalert2";

type SignaturePadProps = {
    title: string;
    value: string;
    onChange: (base64: string) => void;
    compact?: boolean; // para modal
};

export default function SignaturePad({ title, value, onChange, compact }: SignaturePadProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);

    const setupCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();

        // altura variable: más alto si no es compact
        const cssHeight = compact ? 220 : 180;

        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(cssHeight * dpr);
        canvas.style.height = `${cssHeight}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineWidth = 2.4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
    };

    useEffect(() => {
        setupCanvas();

        const onResize = () => setupCanvas();
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        drawingRef.current = true;
        canvas.setPointerCapture(e.pointerId);

        const p = getPos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawingRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const p = getPos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    };

    const onPointerUp = () => {
        drawingRef.current = false;
        const canvas = canvasRef.current;
        if (!canvas) return;
        onChange(canvas.toDataURL("image/png"));
    };

    const clear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const rect = canvas.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        onChange("");
    };

    const save = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const base64 = canvas.toDataURL("image/png");
        if (!base64 || base64.length < 100) {
            Swal.fire({ icon: "warning", title: "Firma vacía", text: "Dibuja una firma antes de guardar." });
            return;
        }

        onChange(base64);
        await Swal.fire({ icon: "success", title: "Firma guardada", timer: 700, showConfirmButton: false });
    };

    return (
        <div className="space-y-3">
            {!!title && (
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Dibuja con mouse o touch</p>
                    </div>

                    {value ? (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-[11px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            Lista
                        </span>
                    ) : (
                        <span className="rounded-full bg-yellow-100 px-2 py-1 text-[11px] font-semibold text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                            Pendiente
                        </span>
                    )}
                </div>
            )}

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <canvas
                    ref={canvasRef}
                    className="w-full touch-none"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                />
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={clear}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                >
                    Limpiar
                </button>

                <button
                    type="button"
                    onClick={save}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                    Guardar firma
                </button>
            </div>
        </div>
    );
}
