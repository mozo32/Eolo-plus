import { ChevronLeft, ChevronRight } from 'lucide-react';

const POR_PAGINA = [10, 25, 50];

interface Props {
    pagina: number;
    ultimaPagina: number;
    total: number;
    porPagina: number;
    onPagina: (pagina: number) => void;
    onPorPagina: (porPagina: number) => void;
}

export default function PaginadorRelevos({ pagina, ultimaPagina, total, porPagina, onPagina, onPorPagina }: Props) {
    const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
    const hasta = Math.min(pagina * porPagina, total);

    return (
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
            <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    Mostrando {desde} - {hasta} de {total}
                </span>
                <select
                    value={porPagina}
                    onChange={e => onPorPagina(Number(e.target.value))}
                    className="rounded border border-slate-200 bg-white p-1.5 text-[10px] font-black uppercase outline-none focus:border-blue-400"
                    title="Registros por página"
                >
                    {POR_PAGINA.map(n => (
                        <option key={n} value={n}>{n} por página</option>
                    ))}
                </select>
            </div>

            <div className="flex items-center gap-1">
                <button
                    type="button"
                    disabled={pagina === 1}
                    onClick={() => onPagina(pagina - 1)}
                    className="flex items-center gap-1 rounded border border-slate-200 px-4 py-2 text-[10px] font-black transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                    <ChevronLeft size={14} /> ANTERIOR
                </button>
                <span className="rounded border border-indigo-100 bg-indigo-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600">
                    PÁGINA {pagina} DE {ultimaPagina}
                </span>
                <button
                    type="button"
                    disabled={pagina >= ultimaPagina}
                    onClick={() => onPagina(pagina + 1)}
                    className="flex items-center gap-1 rounded border border-slate-200 px-4 py-2 text-[10px] font-black transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                    SIGUIENTE <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}
