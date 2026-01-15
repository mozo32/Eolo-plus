import { useRef } from "react";

export interface PuntoDanio {
    x: number; // %
    y: number; // %
    z: number;
    descripcion?: string | null;
    severidad?: string | null;
}

interface MapaDaniosProps {
    value: PuntoDanio[];
    onChange?: (puntos: PuntoDanio[]) => void;
    imageSrc?: string;

    readOnly?: boolean;
    title?: string;
    helpText?: string;
}

export default function MapaDanios({
    value,
    onChange,
    imageSrc = "/pngtree-top-view-of-commercial-airplane-png-image_14441279",
    readOnly = false,
    title = "Mapa de daños",
    helpText = "Da clic sobre la aeronave para marcar un daño (rojo)",
}: MapaDaniosProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (readOnly) return; // no permitir marcar
        if (!onChange) return;
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        onChange([...value, { x, y, z:0}]);
    };

    const removePoint = (index: number) => {
        if (readOnly) return; // no permitir eliminar
        if (!onChange) return;

        const next = [...value];
        next.splice(index, 1);
        onChange(next);
    };

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <p className="text-xs text-gray-500">
                {readOnly ? "Solo visualización de daños marcados." : helpText}
            </p>

            <div
                ref={containerRef}
                onClick={handleClick}
                className={[
                    "relative mx-auto max-w-3xl rounded-xl border border-gray-300 bg-white shadow-sm",
                    "dark:border-gray-700 dark:bg-gray-900",
                    readOnly ? "cursor-default" : "cursor-crosshair",
                ].join(" ")}
            >
                <img
                    src={imageSrc}
                    alt="Mapa de la aeronave"
                    className="w-full select-none rounded-xl"
                    draggable={false}
                />

                {value.map((p, idx) => (
                    <div
                        key={idx}
                        style={{ left: `${p.x}%`, top: `${p.y}%` }}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                    >
                        {/* en readOnly usamos div (no botón) */}
                        {readOnly ? (
                            <div
                                title={`Daño #${idx + 1}${p.descripcion ? `: ${p.descripcion}` : ""}${p.severidad ? ` (${p.severidad})` : ""
                                    }`}
                                className="h-4 w-4 rounded-full bg-red-600 ring-2 ring-white"
                            />
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removePoint(idx);
                                }}
                                title="Eliminar daño"
                                className="h-4 w-4 rounded-full bg-red-600 ring-2 ring-white hover:scale-110 transition dark:ring-gray-900"
                            />
                        )}
                    </div>
                ))}
            </div>

            <div className="text-xs text-gray-500">
                Daños marcados: <b>{value.length}</b>
            </div>
        </div>
    );
}
