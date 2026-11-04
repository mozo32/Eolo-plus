import { Calendar, ChevronDown, Eye, Pencil, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import ModalPeriodo, { type RangoPeriodo } from '@/components/ModalPeriodo';
import { eliminarRelevo, ErrorDeApi, fetchRelevos } from '@/stores/apiEntregaTurnoSeguridad';
import { CeldaSeccion, idUnicoDe, pernoctaDelDia } from './CeldasRelevo';
import PaginadorRelevos from './PaginadorRelevos';
import SelectorSeccion from './SelectorSeccion';
import { etiquetaPeriodo, formatearFecha, type FilaRelevo, type FiltrosRelevo } from './types';

interface Props {
    puedeEditar: boolean;
    /** Cada vez que cambia, la tabla vuelve a pedir el listado. */
    recargar: number;
    onEditar: (id: number) => void;
    onVerPrevia: (fila: FilaRelevo) => void;
}

const TH = 'px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center';
const FILTRO = 'w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center';

const toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });

const FILTROS_INICIALES: FiltrosRelevo = { search: '', seccion: '', estado: '', fecha_inicio: '', fecha_fin: '' };
const PERIODO_INICIAL: RangoPeriodo = { periodo: 'mes', fecha_inicio: '', fecha_fin: '' };

type Accion = 'editar' | 'eliminar';

export default function TablaEntregaTurno({ puedeEditar, recargar, onEditar, onVerPrevia }: Props) {
    const [filtros, setFiltros] = useState<FiltrosRelevo>(FILTROS_INICIALES);
    const [periodo, setPeriodo] = useState<RangoPeriodo>(PERIODO_INICIAL);
    const [modalPeriodoAbierto, setModalPeriodoAbierto] = useState(false);
    const [pagina, setPagina] = useState(1);
    const [porPagina, setPorPagina] = useState(10);
    const [filas, setFilas] = useState<FilaRelevo[]>([]);
    const [total, setTotal] = useState(0);
    const [ultimaPagina, setUltimaPagina] = useState(1);
    const [cargando, setCargando] = useState(false);
    const [recargaLocal, setRecargaLocal] = useState(0);
    const [eligiendo, setEligiendo] = useState<{ fila: FilaRelevo; accion: Accion } | null>(null);

    useEffect(() => {
        let vigente = true;

        // La espera evita una petición por tecla en la búsqueda.
        const temporizador = setTimeout(async () => {
            setCargando(true);

            try {
                const respuesta = await fetchRelevos({ ...filtros, page: pagina, per_page: porPagina });

                if (!vigente) return;

                // Si se borró el último renglón de la última página, se retrocede.
                if (respuesta.data.length === 0 && pagina > 1) {
                    setPagina(Math.max(1, respuesta.meta.last_page));
                    return;
                }

                setFilas(respuesta.data);
                setTotal(respuesta.meta.total);
                setUltimaPagina(Math.max(1, respuesta.meta.last_page));
            } catch (error) {
                if (!vigente) return;
                setFilas([]);
                toast.fire({
                    icon: 'error',
                    title: error instanceof Error ? error.message : 'No se pudo cargar la lista',
                });
            } finally {
                if (vigente) setCargando(false);
            }
        }, 300);

        return () => {
            vigente = false;
            clearTimeout(temporizador);
        };
    }, [filtros, pagina, porPagina, recargar, recargaLocal]);

    const cambiarFiltros = (cambio: Partial<FiltrosRelevo>) => {
        setFiltros(actual => ({ ...actual, ...cambio }));
        setPagina(1);
    };

    const limpiar = () => {
        setFiltros(FILTROS_INICIALES);
        setPeriodo(PERIODO_INICIAL);
        setPagina(1);
    };

    const eliminar = async (id: number) => {
        const confirmacion = await Swal.fire({
            title: '¿Estás seguro?',
            text: 'Se eliminará el registro de esta sección.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#f87171',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true,
        });

        if (!confirmacion.isConfirmed) return;

        try {
            await eliminarRelevo(id);
            toast.fire({ icon: 'success', title: 'El registro fue eliminado.' });
        } catch (error) {
            // Un 404 es que alguien ya lo borró: basta con refrescar la lista.
            if (!(error instanceof ErrorDeApi && error.status === 404)) {
                Swal.fire({
                    icon: 'error',
                    title: 'No se pudo eliminar',
                    text: error instanceof Error ? error.message : 'Error inesperado',
                });
                return;
            }
        }

        setRecargaLocal(n => n + 1);
    };

    const actuar = (accion: Accion, id: number) => {
        setEligiendo(null);

        if (accion === 'editar') {
            onEditar(id);
        } else {
            void eliminar(id);
        }
    };

    const pedirAccion = (accion: Accion, fila: FilaRelevo) => {
        const id = idUnicoDe(fila);

        if (id !== null) {
            actuar(accion, id);
        } else {
            setEligiendo({ fila, accion });
        }
    };

    return (
        <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="custom-scrollbar overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-left">
                        <thead>
                            <tr className="border-b border-slate-100 bg-white">
                                <th className={TH}>Fecha</th>
                                <th className={TH}>Frente</th>
                                <th className={TH}>Atrás</th>
                                <th className={TH}>Pernocta mensual</th>
                                <th className="px-6 py-4 text-right text-[9px] font-black uppercase text-slate-400">Acciones</th>
                            </tr>

                            <tr className="bg-slate-50">
                                <td className="border-b border-slate-200 px-2 py-2">
                                    <button
                                        type="button"
                                        onClick={() => setModalPeriodoAbierto(true)}
                                        title="Filtrar por día, rango, mes o año"
                                        className={`${FILTRO} flex items-center justify-between gap-2 text-left`}
                                    >
                                        <span className="flex items-center gap-1.5 overflow-hidden">
                                            <Calendar size={14} className="shrink-0 text-[#00677F]" />
                                            <span className="truncate font-bold uppercase text-slate-600">{etiquetaPeriodo(periodo)}</span>
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
                                        onChange={e => cambiarFiltros({ search: e.target.value.toUpperCase() })}
                                    />
                                </td>
                                <td className="border-b border-slate-200 px-2 py-2">
                                    <select
                                        className={FILTRO}
                                        value={filtros.seccion}
                                        onChange={e => cambiarFiltros({ seccion: e.target.value as FiltrosRelevo['seccion'] })}
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
                                        onChange={e => cambiarFiltros({ estado: e.target.value as FiltrosRelevo['estado'] })}
                                    >
                                        <option value="">TODOS</option>
                                        <option value="falta_fbo">FALTA FBO</option>
                                        <option value="completas">COMPLETAS</option>
                                    </select>
                                </td>
                                <td className="border-b border-slate-200 px-2 py-2 text-right">
                                    <button type="button" onClick={limpiar} className="p-1.5 text-slate-400 transition-colors hover:text-red-500" title="Limpiar filtros">
                                        <X size={14} />
                                    </button>
                                </td>
                            </tr>
                        </thead>

                        <tbody className={cargando ? 'opacity-60' : ''}>
                            {filas.length > 0 ? (
                                filas.map(fila => (
                                    <tr key={fila.fecha} className="border-b border-slate-50 transition-colors hover:bg-slate-50/80">
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-[10px] font-bold text-slate-800">{formatearFecha(fila.fecha)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center"><CeldaSeccion seccion={fila.frente} /></td>
                                        <td className="px-6 py-4 text-center"><CeldaSeccion seccion={fila.atras} /></td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-[10px] font-bold uppercase text-slate-600">{pernoctaDelDia(fila)}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button type="button" onClick={() => onVerPrevia(fila)} title="Vista previa del día" className="p-2 text-slate-400 transition-colors hover:text-indigo-600">
                                                    <Eye size={16} />
                                                </button>
                                                {puedeEditar && (
                                                    <>
                                                        <button type="button" onClick={() => pedirAccion('editar', fila)} title="Editar" className="p-2 text-slate-400 transition-colors hover:text-indigo-600">
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button type="button" onClick={() => pedirAccion('eliminar', fila)} title="Eliminar" className="p-2 text-slate-400 transition-colors hover:text-red-500">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {cargando ? 'Cargando...' : 'No se encontraron relevos'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <PaginadorRelevos
                pagina={pagina}
                ultimaPagina={ultimaPagina}
                total={total}
                porPagina={porPagina}
                onPagina={setPagina}
                onPorPagina={n => {
                    setPorPagina(n);
                    setPagina(1);
                }}
            />

            {eligiendo && (
                <SelectorSeccion
                    fila={eligiendo.fila}
                    accion={eligiendo.accion}
                    onElegir={id => actuar(eligiendo.accion, id)}
                    onCerrar={() => setEligiendo(null)}
                />
            )}

            {modalPeriodoAbierto && (
                <ModalPeriodo
                    filtros={periodo}
                    onCerrar={() => setModalPeriodoAbierto(false)}
                    onAplicar={cambio => {
                        setPeriodo(cambio);
                        cambiarFiltros({ fecha_inicio: cambio.fecha_inicio, fecha_fin: cambio.fecha_fin });
                        setModalPeriodoAbierto(false);
                    }}
                />
            )}
        </div>
    );
}
