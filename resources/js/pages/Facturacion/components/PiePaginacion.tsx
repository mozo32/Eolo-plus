import { ChevronLeft, ChevronRight } from 'lucide-react';
import { POR_PAGINA_OPCIONES } from './estilos';

interface Props {
    pagina: number;
    totalPaginas: number;
    total: number;
    porPagina: number;
    onPagina: (pagina: number) => void;
    onPorPagina: (cantidad: number) => void;
}

/** Pie de tabla paginada: mismo aspecto que el de Préstamo de chalecos. */
export default function PiePaginacion({ pagina, totalPaginas, total, porPagina, onPagina, onPorPagina }: Props) {
    const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
    const hasta = Math.min(pagina * porPagina, total);

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Mostrando {desde} - {hasta} de {total}
                </span>
                <select
                    value={porPagina}
                    onChange={e => onPorPagina(Number(e.target.value))}
                    className="text-[10px] font-black border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase"
                    title="Registros por página"
                >
                    {POR_PAGINA_OPCIONES.map(n => (
                        <option key={n} value={n}>
                            {n} por página
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex gap-1 items-center">
                <button
                    type="button"
                    disabled={pagina <= 1}
                    onClick={() => onPagina(pagina - 1)}
                    className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 transition-colors"
                >
                    <ChevronLeft size={14} /> ANTERIOR
                </button>

                <span className="px-4 text-[10px] font-black text-indigo-600 bg-indigo-50 py-2 rounded border border-indigo-100 uppercase tracking-widest">
                    PÁGINA {pagina} DE {totalPaginas}
                </span>

                <button
                    type="button"
                    disabled={pagina >= totalPaginas}
                    onClick={() => onPagina(pagina + 1)}
                    className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 transition-colors"
                >
                    SIGUIENTE <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}
