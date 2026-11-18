import { Eye, Filter, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import ModalPeriodo, { type RangoPeriodo } from '@/components/ModalPeriodo';
import { eliminarRelevo, ErrorDeApi, fetchRelevos } from '@/stores/apiEntregaTurnoSeguridad';
import { DistintivoFirmas } from './CeldasRelevo';
import FilaFiltros from './FilaFiltros';
import PaginadorRelevos from './PaginadorRelevos';
import { etiquetaPeriodo, formatearFecha, type FilaRelevo, type FiltrosRelevo } from './types';

interface Props {
    puedeEditar: boolean;
    /** Cada vez que cambia, la tabla vuelve a pedir el listado. */
    recargar: number;
    /** La tabla lo llama cuando necesita que la página incremente `recargar`. */
    onRecargar: () => void;
    onEditar: (id: number) => void;
    onVerPrevia: (id: number) => void;
}

const TH = 'px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center';

const toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });

const FILTROS_INICIALES: FiltrosRelevo = { search: '', estado: '', fecha_inicio: '', fecha_fin: '' };
const PERIODO_INICIAL: RangoPeriodo = { periodo: 'mes', fecha_inicio: '', fecha_fin: '' };

export default function TablaEntregaTurno({ puedeEditar, recargar, onRecargar, onEditar, onVerPrevia }: Props) {
    const [filtros, setFiltros] = useState<FiltrosRelevo>(FILTROS_INICIALES);
    const [periodo, setPeriodo] = useState<RangoPeriodo>(PERIODO_INICIAL);
    const [modalPeriodoAbierto, setModalPeriodoAbierto] = useState(false);
    // La fila de filtros nace oculta y la enseña el botón FILTRAR, como en Operaciones Diarias.
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [pagina, setPagina] = useState(1);
    const [porPagina, setPorPagina] = useState(10);
    const [filas, setFilas] = useState<FilaRelevo[]>([]);
    const [total, setTotal] = useState(0);
    const [ultimaPagina, setUltimaPagina] = useState(1);
    const [cargando, setCargando] = useState(false);
    // Lo que el buscador ya aplicó: se retrasa 300 ms para no pedir por tecla.
    const [busqueda, setBusqueda] = useState('');

    useEffect(() => {
        const temporizador = setTimeout(() => {
            // El efecto solo corre al cambiar el texto (o al montar): se vuelve a la primera página.
            setPagina(1);
            setBusqueda(filtros.search ?? '');
        }, 300);

        return () => clearTimeout(temporizador);
    }, [filtros.search]);

    const { estado, fecha_inicio, fecha_fin } = filtros;

    useEffect(() => {
        let vigente = true;

        const cargar = async () => {
            setCargando(true);

            try {
                const respuesta = await fetchRelevos({
                    search: busqueda,
                    estado,
                    fecha_inicio,
                    fecha_fin,
                    page: pagina,
                    per_page: porPagina,
                });

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
                setTotal(0);
                setUltimaPagina(1);
                toast.fire({
                    icon: 'error',
                    // `ErrorDeApi` y no `Error`: un fallo de red lanza un
                    // `TypeError` cuyo mensaje es «Failed to fetch», en inglés.
                    title: error instanceof ErrorDeApi ? error.message : 'No se pudo cargar la lista',
                });
            } finally {
                if (vigente) setCargando(false);
            }
        };

        void cargar();

        return () => {
            vigente = false;
        };
    }, [busqueda, estado, fecha_inicio, fecha_fin, pagina, porPagina, recargar]);

    const cambiarFiltros = (cambio: Partial<FiltrosRelevo>) => {
        setFiltros(actual => ({ ...actual, ...cambio }));
        setPagina(1);
    };

    const escribirBusqueda = (search: string) => setFiltros(actual => ({ ...actual, search }));

    const limpiar = () => {
        setFiltros(FILTROS_INICIALES);
        setBusqueda('');
        setPeriodo(PERIODO_INICIAL);
        setPagina(1);
    };

    const eliminar = async (id: number) => {
        const confirmacion = await Swal.fire({
            title: '¿Estás seguro?',
            text: 'Se eliminará este relevo.',
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
                    text: error instanceof ErrorDeApi ? error.message : 'No se pudo conectar con el servidor.',
                });
                return;
            }
        }

        onRecargar();
    };

    return (
        <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-6 py-4 md:flex-row md:items-center">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Relevos</h3>

                    {/* Mismo botón que en Operaciones Diarias: la fila de filtros nace oculta. */}
                    <button
                        type="button"
                        onClick={() => setMostrarFiltros(!mostrarFiltros)}
                        className={`flex items-center gap-2 rounded border px-4 py-2 text-[10px] font-black transition-all ${mostrarFiltros ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                        <Filter size={14} />
                        <span className="hidden sm:inline">{mostrarFiltros ? 'OCULTAR FILTROS' : 'FILTRAR'}</span>
                    </button>
                </div>

                <div className="custom-scrollbar overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-left">
                        <thead>
                            <tr className="border-b border-slate-100 bg-white">
                                <th className={TH}>Fecha</th>
                                <th className={TH}>Hora</th>
                                <th className={TH}>Quien entrega</th>
                                <th className={TH}>Pernocta del día</th>
                                <th className={TH}>Estado</th>
                                <th className="px-6 py-4 text-right text-[9px] font-black uppercase text-slate-400">Acciones</th>
                            </tr>

                            <FilaFiltros
                                filtros={filtros}
                                etiquetaFecha={etiquetaPeriodo(periodo)}
                                abierto={mostrarFiltros}
                                onAbrirFechas={() => setModalPeriodoAbierto(true)}
                                onCambiar={cambiarFiltros}
                                onBuscar={escribirBusqueda}
                                onLimpiar={limpiar}
                            />
                        </thead>

                        <tbody className={cargando ? 'opacity-60' : ''}>
                            {filas.length > 0 ? (
                                filas.map(fila => (
                                    <tr key={fila.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/80">
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-[10px] font-bold text-slate-800">{formatearFecha(fila.fecha)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-[10px] text-slate-500">{fila.hora}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-[11px] font-bold text-slate-700">{fila.nombre}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-[10px] font-bold uppercase text-slate-600">{fila.pernocta}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <DistintivoFirmas faltantes={fila.firmas_faltantes} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button type="button" onClick={() => onVerPrevia(fila.id)} title="Vista previa" className="p-2 text-slate-400 transition-colors hover:text-indigo-600">
                                                    <Eye size={16} />
                                                </button>
                                                {puedeEditar && (
                                                    <>
                                                        <button type="button" onClick={() => onEditar(fila.id)} title="Editar" className="p-2 text-slate-400 transition-colors hover:text-indigo-600">
                                                            <Pencil size={16} />
                                                        </button>
                                                        <button type="button" onClick={() => void eliminar(fila.id)} title="Eliminar" className="p-2 text-slate-400 transition-colors hover:text-red-500">
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
                                    <td colSpan={6} className="px-6 py-20 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
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
