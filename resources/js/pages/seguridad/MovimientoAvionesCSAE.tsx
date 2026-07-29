import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import MovimientoCSAEForm from './MovimientoAvionesCSAE/MovimientoCSAEForm';
import { useState, useEffect, useCallback } from 'react';
import {fetchMovimientoCSAE,fetchShowMovimientoCSAE,fetchAeronavesPendientesCSAE,eliminar,type AeronavePendienteCSAE} from '@/stores/apiMovimientoCSAE';
import { Search, Plane, X, Edit2, Plus, Filter, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, LogOut, Eye} from 'lucide-react';
import PdfCsae from './MovimientoAvionesCSAE/PdfCsae';
import Swal from 'sweetalert2';
import AeronavesPendientesCSAE from './MovimientoAvionesCSAE/AeronavesPendientesCSAE';
import VistaPreviaCsae from './MovimientoAvionesCSAE/VistaPreviaCsae';
const breadcrumbs: BreadcrumbItem[] = [{ title: 'Movimiento Aviones CSAE' }];

export default function MovimientoAvionesCSAE() {
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [data, setData] = useState<any[]>([]);
    const [openForm, setOpenForm] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [detalle, setDetalle] = useState<any>(null);
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [modoSalida, setModoSalida] = useState(false);
    const [modoCompleto, setModoCompleto] = useState(false);
    const [pendientesOpen, setPendientesOpen] = useState(false);
    const [aeronavesPendientes, setAeronavesPendientes] = useState<AeronavePendienteCSAE[]>([]);
    const [previewId, setPreviewId] = useState<number | null>(null);
    const [loadingPendientes, setLoadingPendientes] = useState(false);
    const [errorPendientes, setErrorPendientes] = useState<string | null>(null);
    const formatFecha = (fecha?: string | null) => {
        if (!fecha) return '—';

        const base = String(fecha).includes('T')
            ? String(fecha).split('T')[0]
            : String(fecha).split(' ')[0];

        const [y, m, d] = base.split('-');

        if (!y || !m || !d) return fecha;

        return `${d}/${m}/${y}`;
    };

    const formatHora = (fecha?: string | null) => {
        if (!fecha) return '';

        const date = new Date(fecha);

        if (Number.isNaN(date.getTime())) return '';

        return date.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    };
    const registroYaSalio = (row: any) => {
        return row.ya_salio === true || row.ya_salio === 1 || row.ya_salio === '1';
    };
    const cargarDatos = async () => {
        try {
            setLoading(true);

            const res = await fetchMovimientoCSAE({
                page,
                search,
                per_page: 10,
            });

            setData(res.data || []);
            setMeta(res);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };
    const cargarPendientes = useCallback(async () => {
        try {
            setLoadingPendientes(true);
            setErrorPendientes(null);

            const response = await fetchAeronavesPendientesCSAE();

            setAeronavesPendientes(response.aeronaves || []);
        } catch (error: any) {
            console.error(
                'Error al obtener aeronaves pendientes:',
                error,
            );

            setAeronavesPendientes([]);

            setErrorPendientes(
                error?.message ||
                'No se pudieron cargar las aeronaves pendientes',
            );
        } finally {
            setLoadingPendientes(false);
        }
    }, []);
    const abrirPanelPendientes = async () => {
        setPendientesOpen(true);
        await cargarPendientes();
    };
    useEffect(() => {
        cargarPendientes();
    }, [cargarPendientes]);
    const abrirNuevo = () => {
        setIsEdit(false);
        setModoSalida(false);
        setModoCompleto(false);
        setDetalle(null);
        setOpenForm(true);
    };

    const show = async (id: number) => {
        try {
            const dat = await fetchShowMovimientoCSAE(id);
            setDetalle(dat);
            setIsEdit(true);
            setModoSalida(false);
            setModoCompleto(true);
            setOpenForm(true);
        } catch (error) {
            console.error(error);
        }
    };
    const abrirSalida = async (id: number) => {
        try {
            const dat = await fetchShowMovimientoCSAE(id);
            setDetalle(dat);
            setIsEdit(true);
            setModoSalida(true);
            setModoCompleto(false);
            setOpenForm(true);
        } catch (error) {
            console.error(error);
        }
    };
    const cerrarFormulario = async () => {
        setOpenForm(false);
        setIsEdit(false);
        setModoSalida(false);
        setModoCompleto(false);
        setDetalle(null);

        await Promise.all([
            cargarDatos(),
            cargarPendientes(),
        ]);
    };

    const limpiarFiltros = () => {
        setPage(1);
        setSearch('');
    };

    const handleEliminar = async (id: number) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: 'El registro se marcará como inactivo.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#f87171',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true,
        });

        if (result.isConfirmed) {
            try {
                const res = await eliminar(id);

                if (res.ok) {
                    Swal.fire({
                        title: '¡Eliminado!',
                        text: 'El registro ha sido borrado con éxito.',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false,
                    });

                    cargarDatos();
                } else {
                    throw new Error(res.message || 'Error al eliminar');
                }
            } catch (error: any) {
                Swal.fire('Error', error.message || 'No se pudo eliminar el registro', 'error');
            }
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            cargarDatos();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [page, search]);

    const handlePdfDone = useCallback(() => {
        setPdfId(null);
    }, []);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Movimiento de Aviones CSAE" />

            <div className="p-6 bg-[#f3f4f6] min-h-screen">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                                    Movimiento de Aeronaves
                                </h2>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                    Gestión de entradas y salidas CSAE
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={abrirPanelPendientes}
                                className="relative flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition-all animate-pulse"
                            >
                                <span className="flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                                </span>
                                <span className="font-bold text-sm">
                                    PENDIENTES ({aeronavesPendientes.length})
                                </span>
                            </button>
                        </div>

                        <div className="flex gap-2 items-center">
                            <button
                                type="button"
                                onClick={() => setFiltersOpen(!filtersOpen)}
                                className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded border transition-all ${
                                    filtersOpen
                                        ? 'bg-slate-800 text-white border-slate-800'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <Filter size={14} />
                                <span>{filtersOpen ? 'OCULTAR FILTROS' : 'FILTRAR'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={abrirNuevo}
                                className="text-[10px] font-black px-4 py-2 rounded shadow-md transition-all active:scale-95 text-white flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                            >
                                <Plus size={14} />
                                NUEVO REGISTRO
                            </button>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[900px]">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center w-20">
                                            ID
                                        </th>

                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">
                                            Matrícula
                                        </th>

                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">
                                            Tipo Aeronave
                                        </th>

                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">
                                            Entrada
                                        </th>

                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">
                                            Salida
                                        </th>

                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">
                                            Estado
                                        </th>

                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">
                                            Acciones
                                        </th>
                                    </tr>

                                    <tr className={`bg-slate-50 transition-all duration-300 ease-in-out ${filtersOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <div className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white text-slate-400 font-bold uppercase text-center">
                                                #
                                            </div>
                                        </td>

                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <div className="relative">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar matrícula..."
                                                    value={search}
                                                    onChange={(e) => {
                                                        setPage(1);
                                                        setSearch(e.target.value.toUpperCase());
                                                    }}
                                                    className="w-full text-[10px] border border-slate-200 py-1.5 pl-7 pr-2 rounded bg-white outline-none focus:border-blue-400 uppercase text-center"
                                                />
                                            </div>
                                        </td>

                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <div className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white text-slate-400 font-bold uppercase text-center">
                                                Todos
                                            </div>
                                        </td>

                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <div className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white text-slate-400 font-bold uppercase text-center">
                                                Fecha entrada
                                            </div>
                                        </td>

                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <div className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white text-slate-400 font-bold uppercase text-center">
                                                Fecha salida
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <div className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white text-slate-400 font-bold uppercase text-center">
                                                Estado
                                            </div>
                                        </td>
                                        <td className="px-2 py-2 border-b border-slate-200 text-right">
                                            <button
                                                type="button"
                                                onClick={limpiarFiltros}
                                                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                                title="Limpiar filtros"
                                            >
                                                <X size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                </thead>

                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Cargando datos...
                                            </td>
                                        </tr>
                                    ) : data.length > 0 ? (
                                        data.map((row) => {
                                            const salio = registroYaSalio(row);

                                            return (
                                                <tr
                                                    key={row.id}
                                                    className={`border-b border-slate-50 transition-colors ${
                                                        salio
                                                            ? 'hover:bg-green-50/40'
                                                            : 'bg-orange-50/30 hover:bg-orange-50/60'
                                                    }`}
                                                >
                                                    <td className="px-4 py-4 text-center font-black text-[10px] text-slate-700">
                                                        #{row.id}
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center gap-2 justify-center">
                                                            <div
                                                                className={`h-6 w-6 rounded-full flex items-center justify-center border shrink-0 ${
                                                                    salio
                                                                        ? 'bg-green-50 text-green-600 border-green-100'
                                                                        : 'bg-orange-50 text-orange-600 border-orange-100'
                                                                }`}
                                                            >
                                                                <Plane size={13} />
                                                            </div>

                                                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                                                                {row.matricula || '—'}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tight border bg-slate-50 text-slate-600 border-slate-200">
                                                            {row.tipo_aeronave || '—'}
                                                        </span>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-bold text-slate-400 block uppercase">
                                                                {formatFecha(row.fecha_hora_entrada)}
                                                            </span>
                                                            <span className="font-bold text-[10px] text-slate-800">
                                                                {formatHora(row.fecha_hora_entrada)}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        {salio ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-[9px] font-bold text-slate-400 block uppercase">
                                                                    {formatFecha(row.fecha_hora_salida)}
                                                                </span>
                                                                <span className="font-bold text-[10px] text-slate-800">
                                                                    {formatHora(row.fecha_hora_salida)}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tight border bg-orange-50 text-orange-600 border-orange-200">
                                                                <AlertCircle size={12} className="animate-pulse" />
                                                                Pendiente
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <span
                                                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tight border ${
                                                                salio
                                                                    ? 'bg-green-50 text-green-600 border-green-200'
                                                                    : 'bg-orange-50 text-orange-600 border-orange-200'
                                                            }`}
                                                        >
                                                            {salio ? (
                                                                <>
                                                                    <CheckCircle2 size={12} />
                                                                    Ya salió
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <AlertCircle size={12} className="animate-pulse" />
                                                                    En plataforma
                                                                </>
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <button
                                                                type="button"
                                                                className="rounded p-2 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600"
                                                                onClick={() => setPreviewId(row.id)}
                                                                title="Vista previa"
                                                            >
                                                                <Eye size={16} />
                                                            </button>
                                                            {!salio && (

                                                                <button
                                                                    type="button"
                                                                    className="p-2 rounded transition-colors text-slate-400 hover:text-orange-600"
                                                                    onClick={() => abrirSalida(row.id)}
                                                                    title="Registrar salida"
                                                                >
                                                                    <LogOut size={16} />
                                                                </button>
                                                            )}

                                                            <button
                                                                type="button"
                                                                className="p-2 rounded transition-colors text-slate-400 hover:text-indigo-600"
                                                                onClick={() => show(row.id)}
                                                                title={salio ? 'Ver o editar registro' : 'Editar entrada'}
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="p-2 text-slate-400 hover:text-amber-600 font-black text-[10px]"
                                                                title="Descargar PDF"
                                                                onClick={() => setPdfId(row.id)}
                                                            >
                                                                PDF
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                                                title="Eliminar"
                                                                onClick={() => handleEliminar(row.id)}
                                                            >
                                                                <svg
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    width="16"
                                                                    height="16"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                >
                                                                    <path d="M3 6h18" />
                                                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                No hay registros disponibles
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {meta && meta.last_page > 1 && (
                        <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                Mostrando {meta.from || 0} - {meta.to || 0} de {meta.total || 0}
                            </div>

                            <div className="flex gap-1 items-center">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(page - 1)}
                                    className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 transition-colors"
                                >
                                    <ChevronLeft size={14} />
                                    ANTERIOR
                                </button>

                                <span className="px-4 text-[10px] font-black text-indigo-600 bg-indigo-50 py-2 rounded border border-indigo-100 uppercase tracking-widest">
                                    PÁGINA {meta.current_page} DE {meta.last_page}
                                </span>

                                <button
                                    disabled={page === meta.last_page}
                                    onClick={() => setPage(page + 1)}
                                    className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 transition-colors"
                                >
                                    SIGUIENTE
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {openForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative z-10 flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between border-b border-blue-800 bg-blue-900 px-6 py-5 text-white">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight">
                                    {modoCompleto
                                        ? 'Editar registro completo CSAE'
                                        : modoSalida
                                            ? 'Registrar salida CSAE'
                                            : 'Registrar movimiento CSAE'}
                                </h3>

                                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-blue-200">
                                    Módulo de movimiento de aeronaves
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={cerrarFormulario}
                                className="rounded-full p-2 text-blue-200 transition-colors hover:bg-blue-800 hover:text-white"
                                title="Cerrar"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto bg-[#f8fafc] custom-scrollbar">
                            <MovimientoCSAEForm
                                isEdit={isEdit}
                                modoSalida={modoSalida}
                                modoCompleto={modoCompleto}
                                data={detalle}
                                open={openForm}
                                onSuccess={cerrarFormulario}
                            />
                        </div>
                    </div>
                </div>
            )}

            <PdfCsae id={pdfId} onDone={handlePdfDone} />
            <VistaPreviaCsae
                id={previewId}
                onClose={() => setPreviewId(null)}
            />
            <AeronavesPendientesCSAE
                isOpen={pendientesOpen}
                onClose={() => setPendientesOpen(false)}
                aeronaves={aeronavesPendientes}
                loading={loadingPendientes}
                error={errorPendientes}
                onReload={cargarPendientes}
            />
        </AppLayout>
    );
}
