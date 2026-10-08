import type { TipoDanio, ChecklistAvionEstado, ChecklistHelicopteroEstado } from '@/types/typesChecklist';

/**
 * Normaliza el checklist de inspección TAL COMO LO GUARDA la base, en UN solo sitio.
 *
 * Hay dos nombres en juego y confundirlos era el defecto:
 *   - lo GUARDADO (`walkaround_checklists.checklist_avion` / `checklist_helicoptero`) usa la
 *     clave `damages`. Medido: de 2978 checklists, 2978 la usan y ninguno usa `danios`;
 *   - la forma NORMALIZADA que consumen las pantallas usa `danios`, que es el nombre de
 *     `EstadoPreguntaAvion` y `EstadoPreguntaHelicoptero` en `types/typesChecklist.ts`.
 *
 * Cinco lectores escribían la normalización a mano y cuatro leían `danios` del JSON guardado,
 * donde esa clave no existe: cada zona caía al camino de respaldo y salía «sin daño» aunque
 * tuviera daños. Se veía en la pantalla de firma de los helicópteros, pero el error estaba en
 * cuatro sitios más. Una prueba (`tests/Feature/WalkAroundChecklistDanioTest.php`) exige que
 * `damages` solo se lea aquí.
 *
 * Los dos tipos de aeronave comparten forma, así que una sola función sirve para los dos.
 */

const DANIOS_VALIDOS = [
    'sin_danio',
    'golpe',
    'rayon',
    'fisurado',
    'quebrado',
    'pintura_cuarteada',
    'otro',
] as const;

const esTipoDanio = (valor: unknown): valor is TipoDanio =>
    typeof valor === 'string' && (DANIOS_VALIDOS as readonly string[]).includes(valor);

/**
 * Formas sueltas que aparecen en registros viejos: la zona guardada como arreglo de daños,
 * o como la cadena `sin_danio` / `con_danio` en lugar de un objeto.
 */
const comoArreglo = (valor: unknown): TipoDanio[] => {
    if (Array.isArray(valor)) {
        return valor.filter(esTipoDanio);
    }

    if (valor === 'sin_danio') {
        return ['sin_danio'];
    }

    if (valor === 'con_danio') {
        return ['otro'];
    }

    return [];
};

/**
 * Convierte el checklist guardado en la forma que consumen las pantallas. Una entrada que no
 * sea un objeto da un checklist vacío, no un checklist con todo en «sin daño»: no es lo mismo
 * «no hay checklist» que «se revisó y no había daños».
 */
export function normalizarChecklistGuardado(entrada: unknown): ChecklistAvionEstado & ChecklistHelicopteroEstado {
    const salida: ChecklistAvionEstado = {};

    if (!entrada || typeof entrada !== 'object') {
        return salida;
    }

    for (const [zona, valor] of Object.entries(entrada as Record<string, unknown>)) {
        const crudo = valor as { izq?: unknown; der?: unknown; damages?: unknown } | null;
        const danios = Array.isArray(crudo?.damages)
            ? crudo.damages.filter(esTipoDanio)
            : comoArreglo(valor);

        salida[zona] = {
            izq: Boolean(crudo?.izq),
            der: Boolean(crudo?.der),
            danios,
        };
    }

    return salida;
}
