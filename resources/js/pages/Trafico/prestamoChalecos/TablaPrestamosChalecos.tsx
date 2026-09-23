import { Calendar, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, ImageOff, X } from 'lucide-react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import ModalPeriodo from '@/components/ModalPeriodo';
import { urlFotoIne } from '@/stores/apiPrestamoChalecos';
import {
    POR_PAGINA_OPCIONES,
    etiquetaPeriodo,
    formatearFecha,
    formatearFechaHora,
    type EstadoPrestamoChaleco,
    type PrestamoChaleco,
} from './types';
import type { PrestamosChalecos } from './usePrestamosChalecos';
import VisorEvidencia from './VisorEvidencia';

interface Props {
    prestamos: PrestamosChalecos;
    filtersOpen: boolean;
}

// Estructura y clases de la tabla estándar de Tráfico (ServicioComisariato.tsx).
const TH = 'px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center';
const FILTRO = 'w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center';

// Badge de estatus de Tráfico (controlMedicamento/InventoryTable.tsx).
const BADGE: Record<EstadoPrestamoChaleco, string> = {
    prestado: 'bg-orange-100 text-orange-600',
    devuelto: 'bg-emerald-100 text-emerald-600',
};

const toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });

export default function TablaPrestamosChalecos({ prestamos, filtersOpen }: Props) {
    const { registros, total, pagina, totalPaginas, porPagina, filtros, setFiltros, limpiarFiltros, cambiarPagina, cambiarPorPagina, tablaRef, marcarDevuelto } =
        prestamos;

    const [evidencia, setEvidencia] = useState<PrestamoChaleco | null>(null);
    const [confirmandoId, setConfirmandoId] = useState<number | null>(null);
    const [modalPeriodoAbierto, setModalPeriodoAbierto] = useState(false);

    const confirmarDevolucion = async (prestamo: PrestamoChaleco) => {
        if (confirmandoId !== null) return;
        setConfirmandoId(prestamo.id);

        try {
            const confirmacion = await Swal.fire({
                title: 'Confirmar devolución',
                text: `¿Confirmas que ${prestamo.nombre_recibe} devolvió el chaleco?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, marcar como devuelto',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#059669',
                reverseButtons: true,
            });

            if (confirmacion.isConfirmed) {
                await marcarDevuelto(prestamo.id);
                toast.fire({ icon: 'success', title: 'El chaleco fue marcado como devuelto.' });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo registrar la devolución',
                text: error instanceof Error ? error.message : 'Error inesperado',
            });
        } finally {
            setConfirmandoId(null);
        }
    };

    const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
    const hasta = Math.min(pagina * porPagina, total);

    return (
        <div ref={tablaRef} className="space-y-4 scroll-mt-4">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Registro de préstamos</h3>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-white border-b border-slate-100">
                                <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center w-20">ID</th>
                                <th className={TH}>Fecha del préstamo</th>
                                <th className={TH}>Recibe</th>
                                <th className={TH}>Entrega</th>
                                <th className={TH}>Evidencia INE</th>
                                <th className={TH}>Estado</th>
                                <th className={TH}>Fecha de devolución</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                            </tr>

                            <tr className={`bg-slate-50 transition-all duration-300 ease-in-out ${filtersOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                                <td className="px-2 py-2 border-b border-slate-200" />
                                <td className="px-2 py-2 border-b border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setModalPeriodoAbierto(true)}
                                        title="Filtrar por día, rango, mes o año"
                                        className={`${FILTRO} flex items-center justify-between gap-2 text-left`}
                                    >
                                        <span className="flex items-center gap-1.5 overflow-hidden">
                                            <Calendar size={14} className="shrink-0 text-[#00677F]" />
                                            <span className="truncate font-bold uppercase text-slate-600">{etiquetaPeriodo(filtros)}</span>
                                        </span>
                                        <ChevronDown size={14} className="shrink-0 text-slate-400" />
                                    </button>
                                </td>
                                <td className="px-2 py-2 border-b border-slate-200">
                                    <input
                                        type="text"
                                        placeholder="Buscar nombre..."
                                        className={FILTRO}
                                        value={filtros.nombre}
                                        onChange={e => setFiltros({ nombre: e.target.value.toUpperCase() })}
                                    />
                                </td>
                                <td className="px-2 py-2 border-b border-slate-200" />
                                <td className="px-2 py-2 border-b border-slate-200" />
                                <td className="px-2 py-2 border-b border-slate-200">
                                    <select className={FILTRO} value={filtros.estado} onChange={e => setFiltros({ estado: e.target.value as '' | EstadoPrestamoChaleco })}>
                                        <option value="">TODOS</option>
                                        <option value="prestado">PRESTADOS</option>
                                        <option value="devuelto">DEVUELTOS</option>
                                    </select>
                                </td>
                                <td className="px-2 py-2 border-b border-slate-200" />
                                <td className="px-2 py-2 border-b border-slate-200 text-right">
                                    <button type="button" onClick={limpiarFiltros} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Limpiar filtros">
                                        <X size={14} />
                                    </button>
                                </td>
                            </tr>
                        </thead>

                        <tbody>
                            {registros.length > 0 ? (
                                registros.map(row => (
                                    <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                        <td className="px-4 py-4 text-center font-black text-[10px] text-slate-700">#{row.id}</td>

                                        <td className="px-6 py-4 text-center">
                                            <span className="text-[10px] font-bold text-slate-800">{formatearFecha(row.fecha)}</span>
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            <span className="text-[11px] font-bold text-slate-600 uppercase">{row.nombre_recibe}</span>
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-bold text-slate-600 uppercase">{row.entregado_por?.name ?? '—'}</span>
                                                <span className="text-[9px] text-slate-400 uppercase tracking-wider">Tráfico</span>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            {row.foto_ine_imagen_id ? (
                                                <button
                                                    type="button"
                                                    onClick={() => setEvidencia(row)}
                                                    title="Ver INE"
                                                    className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-black rounded uppercase tracking-tighter hover:bg-slate-200 transition-colors"
                                                >
                                                    <img src={urlFotoIne(row.id)} alt={`INE de ${row.nombre_recibe}`} className="h-8 w-10 rounded object-cover bg-slate-950" />
                                                    Ver INE
                                                </button>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-400 text-[10px] font-black rounded uppercase tracking-tighter">
                                                    <ImageOff size={12} />
                                                    Sin vista previa
                                                </span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${BADGE[row.estado]}`}>
                                                {row.estado === 'prestado' ? 'Prestado' : 'Devuelto'}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            {row.fecha_devolucion ? (
                                                <span className="text-[10px] font-bold text-slate-800">{formatearFechaHora(row.fecha_devolucion)}</span>
                                            ) : (
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Pendiente</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                {row.estado === 'prestado' ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => confirmarDevolucion(row)}
                                                        disabled={confirmandoId !== null}
                                                        title="Marcar como devuelto"
                                                        className="p-2 rounded transition-colors text-slate-400 hover:text-emerald-600 disabled:opacity-50"
                                                    >
                                                        <CircleCheck size={16} className={confirmandoId === row.id ? 'animate-pulse' : ''} />
                                                    </button>
                                                ) : (
                                                    <span className="p-2 text-[10px] font-black text-slate-300">—</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        No se encontraron préstamos de chalecos
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Mostrando {desde} - {hasta} de {total}
                    </span>
                    <select
                        value={porPagina}
                        onChange={e => cambiarPorPagina(Number(e.target.value))}
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
                        disabled={pagina === 1}
                        onClick={() => cambiarPagina(pagina - 1)}
                        className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 transition-colors"
                    >
                        <ChevronLeft size={14} /> ANTERIOR
                    </button>

                    <span className="px-4 text-[10px] font-black text-indigo-600 bg-indigo-50 py-2 rounded border border-indigo-100 uppercase tracking-widest">
                        PÁGINA {pagina} DE {totalPaginas}
                    </span>

                    <button
                        type="button"
                        disabled={pagina === totalPaginas}
                        onClick={() => cambiarPagina(pagina + 1)}
                        className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 transition-colors"
                    >
                        SIGUIENTE <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {evidencia?.foto_ine_imagen_id && (
                <VisorEvidencia url={urlFotoIne(evidencia.id)} alt={`INE de ${evidencia.nombre_recibe}`} onCerrar={() => setEvidencia(null)} />
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
