import { useRef } from "react";

export interface PuntoDanio {
    x: number; // %
    y: number; // %
}

interface MapaDaniosAvionProps {
    value: PuntoDanio[];
    onChange: (puntos: PuntoDanio[]) => void;
    imageSrc?: string;
}

export default function MapaDaniosAvion({
    value,
    onChange,
    imageSrc = "/pngtree-top-view-of-commercial-airplane-png-image_14441279",
}: MapaDaniosAvionProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        onChange([...value, { x, y }]);
    };

    const removePoint = (index: number) => {
        const next = [...value];
        next.splice(index, 1);
        onChange(next);
    };

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Mapa de daños del avión
            </h3>
            <p className="text-xs text-gray-500">
                Da clic sobre el avión para marcar un daño (rojo)
            </p>

            <div
                ref={containerRef}
                onClick={handleClick}
                className="relative mx-auto max-w-3xl cursor-crosshair rounded-xl border border-gray-300 bg-white shadow-sm
        dark:border-gray-700 dark:bg-gray-900"
            >
                {/* Imagen del avión */}
                <img
                    src={imageSrc}
                    alt="Mapa del avión"
                    className="w-full select-none rounded-xl"
                    draggable={false}
                />

                {/* Puntos de daño */}
                {value.map((p, idx) => (
                    <div
                        key={idx}
                        style={{ left: `${p.x}%`, top: `${p.y}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                    >
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                removePoint(idx);
                            }}
                            title="Eliminar daño"
                            className="h-4 w-4 rounded-full bg-red-600 ring-2 ring-white hover:scale-110 transition
              dark:ring-gray-900"
                        />
                    </div>
                ))}
            </div>

            <div className="text-xs text-gray-500">
                Daños marcados: <b>{value.length}</b>
            </div>
        </div>
    );
}
