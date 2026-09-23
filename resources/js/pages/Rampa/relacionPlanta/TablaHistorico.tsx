import { Calendar, ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import ModalPeriodo from '@/components/ModalPeriodo';
import { PER_PAGE_OPCIONES, etiquetaPeriodo, fechaCorta, formatearHoras, horasAHHMM, type EstadoPrestamo } from './types';
import type { useHistoricoPlanta } from './useHistoricoPlanta';

interface Props {
    historico: ReturnType<typeof useHistoricoPlanta>;
    mostrarFiltros: boolean;
}

const TH = 'px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center';
const TD = 'px-4 py-3 text-center text-xs font-semibold text-slate-700';
const FILTRO = 'w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400';

const BADGE: Record<EstadoPrestamo, string> = {
    en_uso: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200',
    finalizado: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
};

/** Histórico de préstamos con el mismo estilo de tabla que Remisiones. */
export default function TablaHistorico({ historico, mostrarFiltros }: Props) {
    const {
        registros,
        meta,
        cargando,
        filtros,
        setFiltros,
        limpiarFiltros,
        pagina,
        cambiarPagina,
        porPagina,
        cambiarPorPagina,
        tablaRef,
    } = historico;

    const [modalPeriodoAbierto, setModalPeriodoAbierto] = useState(false);

    return (
        <div ref={tablaRef} className="scroll-mt-4 space-y-4">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-left">
                        <thead>
                            <tr className="border-b border-slate-100 bg-white">
                                <th className={`${TH} w-12`}>#</th>
                                <th className={TH}>Fecha</th>
                                <th className={TH}>Empresa</th>
                                <th className={TH}>Matrícula</th>
                                <th className={TH}>Horóm. inicial</th>
                                <th className={TH}>Horóm. final</th>
                                <th className={TH}>Tiempo (h)</th>
                                <th className={TH}>Estado</th>
                            </tr>
                            <tr className={`border-b border-slate-200 bg-slate-50 ${mostrarFiltros ? '' : 'hidden'}`}>
                                <td className="px-2 py-2 text-center">
                                    <button type="button" onClick={limpiarFiltros} title="Limpiar filtros" className="text-slate-400 hover:text-red-500">
                                        <X size={14} />
                                    </button>
                                </td>
                                <td className="px-2 py-2">
                                    <button
                                        type="button"
                                        onClick={() => setModalPeriodoAbierto(true)}
                                        title="Filtrar por día, rango, mes o año"
                                        className="flex w-full items-center justify-between rounded border border-slate-200 bg-white p-1.5 text-[10px] shadow-sm transition-colors hover:border-blue-400"
                                    >
                                        <span className="flex items-center gap-1 overflow-hidden">
                                            <Calendar size={12} className="shrink-0 text-blue-500" />
                                            <span className="truncate font-bold uppercase text-slate-600">{etiquetaPeriodo(filtros)}</span>
                                        </span>
                                        <ChevronDown size={12} className="text-slate-400" />
                                    </button>
                                </td>
                                <td className="px-2 py-2">
                                    <input
                                        type="text"
                                        placeholder="Empresa…"
                                        value={filtros.empresa}
                                        onChange={e => setFiltros({ empresa: e.target.value.toUpperCase() })}
                                        className={`${FILTRO} uppercase`}
                                    />
                                </td>
                                <td className="px-2 py-2">
                                    <input
                                        type="text"
                                        placeholder="Matrícula…"
                                        value={filtros.matricula}
                                        onChange={e => setFiltros({ matricula: e.target.value.toUpperCase() })}
                                        className={`${FILTRO} uppercase`}
                                    />
                                </td>
                                <td />
                                <td />
                                <td />
                                <td />
                            </tr>
                        </thead>
                        <tbody>
                            {cargando ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-20 text-center text-[10px] font-black uppercase text-slate-400">
                                        Cargando datos…
                                    </td>
                                </tr>
                            ) : registros.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-20 text-center text-[10px] font-black uppercase text-slate-400">
                                        No hay préstamos con esos criterios
                                    </td>
                                </tr>
                            ) : (
                                registros.map((p, index) => {
                                    const numero = ((meta?.current_page ?? 1) - 1) * (meta?.per_page ?? porPagina) + index + 1;

                                    return (
                                        <tr
                                            key={p.id}
                                            className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${p.status === 'en_uso' ? 'bg-amber-50/40' : ''}`}
                                        >
                                            <td className={`${TD} font-mono text-[10px] text-slate-400`}>{numero}</td>
                                            <td className={TD}>{fechaCorta(p.fecha)}</td>
                                            <td className={`${TD} uppercase`}>{p.empresa}</td>
                                            <td className={`${TD} font-black tracking-tight`}>{p.matricula}</td>
                                            <td className={`${TD} tabular-nums`}>{formatearHoras(p.horometro_inicio)}</td>
                                            <td className={`${TD} tabular-nums`}>{formatearHoras(p.horometro_fin)}</td>
                                            <td className={`${TD} tabular-nums`}>
                                                {p.tiempo === null ? (
                                                    '—'
                                                ) : (
                                                    <span title="Horas decimales">
                                                        <span className="font-black">{formatearHoras(p.tiempo)} h</span>
                                                        <span className="ml-1 text-[10px] text-slate-400">({horasAHHMM(p.tiempo)})</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td className={TD}>
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${BADGE[p.status]}`}
                                                >
                                                    {p.status === 'en_uso' ? 'En uso' : 'Finalizado'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {meta && (
                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-[10px] font-black uppercase text-slate-500">
                        Página {meta.current_page} de {Math.max(meta.last_page, 1)} · {meta.total} registros
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500">
                            <select
                                value={porPagina}
                                onChange={e => cambiarPorPagina(Number(e.target.value))}
                                className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-black"
                            >
                                {PER_PAGE_OPCIONES.map(n => (
                                    <option key={n} value={n}>
                                        {n}
                                    </option>
                                ))}
                            </select>
                            por página
                        </label>
                        <button
                            type="button"
                            disabled={pagina <= 1}
                            onClick={() => cambiarPagina(pagina - 1)}
                            className="rounded border border-slate-200 px-3 py-1 text-[10px] font-black hover:bg-slate-50 disabled:opacity-50"
                        >
                            ANTERIOR
                        </button>
                        <button
                            type="button"
                            disabled={pagina >= meta.last_page}
                            onClick={() => cambiarPagina(pagina + 1)}
                            className="rounded border border-slate-200 px-3 py-1 text-[10px] font-black hover:bg-slate-50 disabled:opacity-50"
                        >
                            SIGUIENTE
                        </button>
                    </div>
                </div>
            )}

            {modalPeriodoAbierto && (
                <ModalPeriodo
                    filtros={filtros}
                    onCerrar={() => setModalPeriodoAbierto(false)}
                    onAplicar={cambio => {
                        setFiltros(cambio);
                        setModalPeriodoAbierto(false);
                    }}
                />
            )}
        </div>
    );
}
