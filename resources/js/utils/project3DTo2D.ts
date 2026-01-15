export type Punto3D = {
    x: number;
    y: number;
    z: number;
};

export type Punto2D = {
    x: number; // 0–100
    y: number; // 0–100
};

/**
 * Proyección simple de puntos 3D a un plano 2D para PDF
 * Ajusta los rangos si cambias de modelo
 */
export function project3DTo2D(
    p: Punto3D,
    tipo: "avion" | "helicoptero"
): Punto2D {
    if (tipo === "avion") {
        // Vista superior del avión (X,Z)
        return {
            x: clamp(((p.x + 5) / 10) * 100),
            y: clamp(((p.z + 5) / 10) * 100),
        };
    }

    // Helicóptero – vista lateral (X,Y)
    return {
        x: clamp(((p.x + 5) / 10) * 100),
        y: clamp(((p.y + 5) / 10) * 100),
    };
}

function clamp(n: number) {
    return Math.max(0, Math.min(100, n));
}
