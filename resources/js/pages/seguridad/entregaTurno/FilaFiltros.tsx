import { Calendar, ChevronDown, X } from 'lucide-react';
import type { FiltrosRelevo } from './types';

const FILTRO = 'w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center';

interface Props {
    filtros: FiltrosRelevo;
    etiquetaFecha: string;
    onAbrirFechas: () => void;
    onCambiar: (cambio: Partial<FiltrosRelevo>) => void;
    onBuscar: (search: string) => void;
    onLimpiar: () => void;
}

/** La fila de filtros bajo los encabezados de la tabla. */
export default function FilaFiltros({ filtros, etiquetaFecha, onAbrirFechas, onCambiar, onBuscar, onLimpiar }: Props) {
    return (
        <tr className="bg-slate-50">
            <td className="border-b border-slate-200 px-2 py-2">
                <button
                    type="button"
                    onClick={onAbrirFechas}
                    title="Filtrar por día, rango, mes o año"
                    className={`${FILTRO} flex items-center justify-between gap-2 text-left`}
                >
                    <span className="flex items-center gap-1.5 overflow-hidden">
                        <Calendar size={14} className="shrink-0 text-[#00677F]" />
                        <span className="truncate font-bold uppercase text-slate-600">{etiquetaFecha}</span>
                    </span>
                    <ChevronDown size={14} className="shrink-0 text-slate-400" />
                </button>
            </td>
            <td className="border-b border-slate-200 px-2 py-2">
                <input
                    type="text"
                    placeholder="Buscar nombre..."
                    className={FILTRO}
                    value={filtros.search}
                    onChange={e => onBuscar(e.target.value.toUpperCase())}
                />
            </td>
            <td className="border-b border-slate-200 px-2 py-2">
                <select
                    className={FILTRO}
                    value={filtros.seccion}
                    onChange={e => onCambiar({ seccion: e.target.value as FiltrosRelevo['seccion'] })}
                >
                    <option value="">AMBAS SECCIONES</option>
                    <option value="frente">FRENTE</option>
                    <option value="atras">ATRÁS</option>
                </select>
            </td>
            <td className="border-b border-slate-200 px-2 py-2">
                <select
                    className={FILTRO}
                    value={filtros.estado}
                    onChange={e => onCambiar({ estado: e.target.value as FiltrosRelevo['estado'] })}
                >
                    <option value="">TODOS</option>
                    <option value="falta_fbo">FALTA FBO</option>
                    <option value="completas">COMPLETAS</option>
                </select>
            </td>
            <td className="border-b border-slate-200 px-2 py-2 text-right">
                <button type="button" onClick={onLimpiar} className="p-1.5 text-slate-400 transition-colors hover:text-red-500" title="Limpiar filtros">
                    <X size={14} />
                </button>
            </td>
        </tr>
    );
}
