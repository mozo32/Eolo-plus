import type { FiltroEstado } from '@/stores/apiFacturacionCatalogos';
import { Ban, Pencil, RotateCcw } from 'lucide-react';
import { BADGE_ACTIVO, BADGE_BAJA, FILTRO } from './estilos';


/** "Activa" / "De baja" de la columna Estado. */
export function InsigniaEstado({ baja }: { baja: boolean }) {
    return <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${baja ? BADGE_BAJA : BADGE_ACTIVO}`}>{baja ? 'De baja' : 'Activa'}</span>;
}

interface PropsAcciones {
    baja: boolean;
    /** Hay una baja o reactivación en curso en alguna fila. */
    ocupado: boolean;
    /** La acción en curso es la de esta fila. */
    accionando: boolean;
    onEditar: () => void;
    onBaja: () => void;
    onReactivar: () => void;
}

/** Celda de acciones de una fila de catálogo: editar, y dar de baja o reactivar según el estado. */
export function AccionesFila({ baja, ocupado, accionando, onEditar, onBaja, onReactivar }: PropsAcciones) {
    return (
        <div className="flex items-center justify-end gap-1">
            <button type="button" onClick={onEditar} title="Editar" className="p-2 rounded transition-colors text-slate-400 hover:text-indigo-600">
                <Pencil size={16} />
            </button>

            {baja ? (
                <button type="button" onClick={onReactivar} disabled={ocupado} title="Reactivar" className="p-2 rounded transition-colors text-slate-400 hover:text-emerald-600 disabled:opacity-50">
                    <RotateCcw size={16} className={accionando ? 'animate-spin' : ''} />
                </button>
            ) : (
                <button type="button" onClick={onBaja} disabled={ocupado} title="Dar de baja" className="p-2 rounded transition-colors text-slate-400 hover:text-red-600 disabled:opacity-50">
                    <Ban size={16} className={accionando ? 'animate-pulse' : ''} />
                </button>
            )}
        </div>
    );
}

/** Filtro de estado (activas / de baja / todas). */
export function SelectorEstado({ valor, onChange }: { valor: FiltroEstado; onChange: (valor: FiltroEstado) => void }) {
    return (
        <select value={valor} onChange={e => onChange(e.target.value as FiltroEstado)} className={`${FILTRO} md:w-40`} aria-label="Filtrar por estado">
            <option value="activas">ACTIVAS</option>
            <option value="baja">DE BAJA</option>
            <option value="todas">TODAS</option>
        </select>
    );
}

interface PropsFilasEstado {
    columnas: number;
    cargando: boolean;
    error: string | null;
    /** No hay filas que mostrar (después de filtrar). */
    vacio: boolean;
    /** Texto cuando vacío: distingue "no hay nada" de "nada con este filtro". */
    textoVacio: string;
    onReintentar: () => void;
}

/**
 * Las filas de la tabla que no son datos: cargando, error con reintento y vacío.
 * Devuelve null cuando hay datos que pintar.
 */
export function FilasEstado({ columnas, cargando, error, vacio, textoVacio, onReintentar }: PropsFilasEstado) {
    if (cargando) {
        return (
            <tr>
                <td colSpan={columnas} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Cargando…
                </td>
            </tr>
        );
    }

    if (error) {
        return (
            <tr>
                <td colSpan={columnas} className="px-6 py-16 text-center">
                    <p className="text-sm font-medium text-red-600">{error}</p>
                    <button type="button" onClick={onReintentar} className="mt-3 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800">
                        Reintentar
                    </button>
                </td>
            </tr>
        );
    }

    if (vacio) {
        return (
            <tr>
                <td colSpan={columnas} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {textoVacio}
                </td>
            </tr>
        );
    }

    return null;
}
