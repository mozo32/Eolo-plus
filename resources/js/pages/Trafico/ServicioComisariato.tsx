import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import ServicioComisariatoForm from './servicioComisariato/ServicioComisariatoForm';
import { useState, useEffect, useCallback } from 'react';
import { fetchServicioComisariato, fetchShowServicioComisariato, eliminar } from '@/stores/apiServicioComisariato';
import {
    Plus,
    ChevronLeft,
    ChevronRight,
    Edit2,
    Calendar,
    CreditCard,
    Plane,
    Filter,
    X,
    ChevronDown
} from 'lucide-react';
import PdfComisariato from './servicioComisariato/PdfComisariato';
import Swal from 'sweetalert2';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Servicio Comisariato' }];

type PeriodoFiltro = 'todos' | 'dia' | 'rango' | 'mes' | 'año';

type FiltrosComisariato = {
    id: string;
    fechaInicio: string;
    fechaFin: string;
    periodo: PeriodoFiltro;
    catering: string;
    matricula: string;
    forma_pago: string;
};

const filtrosIniciales = (): FiltrosComisariato => ({
    id: '',
    fechaInicio: '',
    fechaFin: '',
    periodo: 'todos',
    catering: '',
    matricula: '',
    forma_pago: '',
});

export default function ServicioComisariato() {
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [data, setData] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [detalle, setDetalle] = useState<any>(null);
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [mostrarModalFecha, setMostrarModalFecha] = useState(false);
    const [filtros, setFiltros] = useState<FiltrosComisariato>(() => filtrosIniciales());
    const [filtrosEdicion, setFiltrosEdicion] = useState<FiltrosComisariato>(() => filtrosIniciales());

    const formatFecha = (fecha?: string | null) => {
        if (!fecha) return "—";

        const base = String(fecha).includes("T")
            ? String(fecha).split("T")[0]
            : String(fecha).split(" ")[0];

        const [y, m, d] = base.split("-");

        if (!y || !m || !d) return fecha;

        return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "long",
            year: "numeric",
        });
    };

    const formatFechaCorta = (fecha?: string | null) => {
        if (!fecha) return "—";

        const base = String(fecha).includes("T")
            ? String(fecha).split("T")[0]
            : String(fecha).split(" ")[0];

        const [y, m, d] = base.split("-");

        if (!y || !m || !d) return fecha;

        return `${d}/${m}/${y}`;
    };

    const formatHora = (fecha?: string | null) => {
        if (!fecha) return "";

        const raw = String(fecha);

        if (!raw.includes("T") && !raw.includes(" ")) return "";

        const hora = raw.includes("T")
            ? raw.split("T")[1]?.slice(0, 5)
            : raw.split(" ")[1]?.slice(0, 5);

        return hora || "";
    };

    const labelFechaFiltro = () => {
        if (filtros.periodo === 'todos' || !filtros.fechaInicio) {
            return 'Todas las fechas';
        }

        if (filtros.periodo === 'dia') {
            return formatFechaCorta(filtros.fechaInicio);
        }

        if (filtros.periodo === 'rango') {
            return `${formatFechaCorta(filtros.fechaInicio)} / ${formatFechaCorta(filtros.fechaFin)}`;
        }

        if (filtros.periodo === 'mes') {
            return filtros.fechaInicio.slice(0, 7);
        }

        if (filtros.periodo === 'año') {
            return filtros.fechaInicio.slice(0, 4);
        }

        return 'Todas las fechas';
    };

    const actualizarFiltro = (key: keyof FiltrosComisariato, value: string) => {
        setPage(1);
        setFiltros((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const limpiarFiltros = () => {
        setPage(1);
        const reset = filtrosIniciales();
        setFiltros(reset);
        setFiltrosEdicion(reset);
    };

    const activarPeriodo = (periodo: PeriodoFiltro) => {
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, '0');
        const dd = String(hoy.getDate()).padStart(2, '0');
        const fechaHoy = `${yyyy}-${mm}-${dd}`;

        if (periodo === 'todos') {
            setFiltrosEdicion({
                ...filtrosEdicion,
                periodo,
                fechaInicio: '',
                fechaFin: '',
            });
            return;
        }

        if (periodo === 'dia') {
            setFiltrosEdicion({
                ...filtrosEdicion,
                periodo,
                fechaInicio: filtrosEdicion.fechaInicio || fechaHoy,
                fechaFin: filtrosEdicion.fechaInicio || fechaHoy,
            });
            return;
        }

        if (periodo === 'rango') {
            setFiltrosEdicion({
                ...filtrosEdicion,
                periodo,
                fechaInicio: filtrosEdicion.fechaInicio || fechaHoy,
                fechaFin: filtrosEdicion.fechaFin || fechaHoy,
            });
            return;
        }

        if (periodo === 'mes') {
            const ultimoDia = new Date(yyyy, Number(mm), 0).getDate();

            setFiltrosEdicion({
                ...filtrosEdicion,
                periodo,
                fechaInicio: `${yyyy}-${mm}-01`,
                fechaFin: `${yyyy}-${mm}-${String(ultimoDia).padStart(2, '0')}`,
            });
            return;
        }

        if (periodo === 'año') {
            setFiltrosEdicion({
                ...filtrosEdicion,
                periodo,
                fechaInicio: `${yyyy}-01-01`,
                fechaFin: `${yyyy}-12-31`,
            });
        }
    };

    const aplicarFiltroFecha = () => {
        setPage(1);
        setFiltros({ ...filtrosEdicion });
        setMostrarModalFecha(false);
    };

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const params: any = {
                page,
                per_page: 10,
                search: '',
                id: filtros.id,
                fechaInicio: filtros.fechaInicio,
                fechaFin: filtros.fechaFin,
                periodo: filtros.periodo,
                catering: filtros.catering,
                matricula: filtros.matricula,
                forma_pago: filtros.forma_pago,
            };
            const res = await fetchServicioComisariato(params);

            setData(res.data || []);
            setMeta(res);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleEliminar = async (id: number) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: "El registro se marcará como inactivo.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#f87171',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true
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
                        showConfirmButton: false
                    });

                    cargarDatos();
                } else {
                    throw new Error(res.message || "Error al eliminar");
                }
            } catch (error: any) {
                Swal.fire('Error', error.message || 'No se pudo eliminar el registro', 'error');
            }
        }
    };

    const handleEdit = async (id: number) => {
        try {
            const dat = await fetchShowServicioComisariato(id);
            setDetalle(dat);
            setIsEdit(true);
            setShowForm(true);
        } catch (error) {
            console.error(error);
        }
    };

    const cerrarModalFormulario = () => {
        setShowForm(false);
        setIsEdit(false);
        setDetalle(null);
    };

    const handlePdfDone = useCallback(() => {
        setPdfId(null);
    }, []);

    useEffect(() => {
        if (mostrarModalFecha) {
            setFiltrosEdicion({ ...filtros });
        }
    }, [mostrarModalFecha]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (!showForm) cargarDatos();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [page, filtros, showForm]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Servicio Comisariato" />

            <div className="p-6 bg-[#f3f4f6] min-h-screen">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                                Servicio Comisariato
                            </h2>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                Gestión de catering y suministros para aeronaves
                            </p>
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
                                onClick={() => {
                                    setIsEdit(false);
                                    setDetalle(null);
                                    setShowForm(true);
                                }}
                                className="text-[10px] font-black px-4 py-2 rounded shadow-md transition-all active:scale-95 text-white bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 flex items-center gap-2"
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
                                            Fecha de Entrega
                                        </th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">
                                            Catering / Servicio
                                        </th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">
                                            Aeronave
                                        </th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">
                                            Pago
                                        </th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">
                                            Acciones
                                        </th>
                                    </tr>

                                    <tr className={`bg-slate-50 transition-all duration-300 ease-in-out ${filtersOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <input
                                                type="text"
                                                placeholder="# ID"
                                                className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center"
                                                value={filtros.id}
                                                onChange={(e) => actualizarFiltro('id', e.target.value)}
                                            />
                                        </td>

                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <button
                                                type="button"
                                                onClick={() => setMostrarModalFecha(true)}
                                                className="w-full flex items-center justify-between text-[10px] border border-slate-200 p-1.5 rounded bg-white hover:border-blue-400 transition-colors shadow-sm"
                                            >
                                                <div className="flex items-center gap-1 overflow-hidden">
                                                    <Calendar size={12} className="text-blue-500 shrink-0" />
                                                    <span className="truncate font-bold text-slate-600 uppercase">
                                                        {labelFechaFiltro()}
                                                    </span>
                                                </div>
                                                <ChevronDown size={12} className="text-slate-400" />
                                            </button>
                                        </td>

                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <input
                                                type="text"
                                                placeholder="Buscar catering..."
                                                className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center"
                                                value={filtros.catering}
                                                onChange={(e) => actualizarFiltro('catering', e.target.value.toUpperCase())}
                                            />
                                        </td>

                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <input
                                                type="text"
                                                placeholder="Buscar matrícula..."
                                                className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center"
                                                value={filtros.matricula}
                                                onChange={(e) => actualizarFiltro('matricula', e.target.value.toUpperCase())}
                                            />
                                        </td>

                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <input
                                                type="text"
                                                placeholder="Buscar pago..."
                                                className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center"
                                                value={filtros.forma_pago}
                                                onChange={(e) => actualizarFiltro('forma_pago', e.target.value.toUpperCase())}
                                            />
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
                                            <td
                                                colSpan={6}
                                                className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest"
                                            >
                                                Cargando datos...
                                            </td>
                                        </tr>
                                    ) : data.length > 0 ? (
                                        data.map((row) => (
                                            <tr
                                                key={row.id}
                                                className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors"
                                            >
                                                <td className="px-4 py-4 text-center font-black text-[10px] text-slate-700">
                                                    #{row.id}
                                                </td>

                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[9px] font-bold text-slate-400 block lowercase first-letter:uppercase">
                                                            {formatFecha(row.fecha_entrega)}
                                                        </span>

                                                        {formatHora(row.fecha_entrega) && (
                                                            <span className="font-bold text-[10px] text-slate-800">
                                                                {formatHora(row.fecha_entrega)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold text-slate-600 uppercase italic">
                                                            {row.catering || "S/N"}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 uppercase tracking-wider">
                                                            Servicio de Comisariato
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-700 text-[10px] font-black rounded uppercase tracking-tighter">
                                                        <Plane size={12} className="text-sky-500" />
                                                        {row.matricula || "-"}
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-black rounded uppercase tracking-tighter">
                                                        <CreditCard size={12} className="text-blue-500" />
                                                        {row.forma_pago || "-"}
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button
                                                            type="button"
                                                            className="p-2 rounded transition-colors text-slate-400 hover:text-blue-600"
                                                            onClick={() => handleEdit(row.id)}
                                                            title="Editar Registro"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="p-2 text-slate-400 hover:text-amber-600 font-black text-[10px]"
                                                            title="Exportar PDF"
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
                                        ))
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest"
                                            >
                                                No se encontraron registros de comisariato
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
                                    type="button"
                                    disabled={page === 1}
                                    onClick={() => setPage(page - 1)}
                                    className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 transition-colors"
                                >
                                    <ChevronLeft size={14} /> ANTERIOR
                                </button>

                                <span className="px-4 text-[10px] font-black text-indigo-600 bg-indigo-50 py-2 rounded border border-indigo-100 uppercase tracking-widest">
                                    PÁGINA {meta.current_page} DE {meta.last_page}
                                </span>

                                <button
                                    type="button"
                                    disabled={page === meta.last_page}
                                    onClick={() => setPage(page + 1)}
                                    className="px-4 py-2 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50 flex items-center gap-1 transition-colors"
                                >
                                    SIGUIENTE <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {mostrarModalFecha && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => setMostrarModalFecha(false)}
                    />

                    <div className="relative z-10 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
                        <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="text-sm font-black uppercase text-slate-700">
                                Período de Fecha de Entrega
                            </h3>

                            <button
                                type="button"
                                onClick={() => setMostrarModalFecha(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                {(['todos', 'dia', 'rango', 'mes', 'año'] as PeriodoFiltro[]).map((modo) => (
                                    <button
                                        key={modo}
                                        type="button"
                                        onClick={() => activarPeriodo(modo)}
                                        className={`flex-1 text-[10px] font-bold py-2 rounded-md transition-all uppercase ${
                                            filtrosEdicion.periodo === modo
                                                ? 'bg-white shadow-sm text-indigo-600'
                                                : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        {modo}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3">
                                {filtrosEdicion.periodo === 'todos' && (
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center text-[11px] font-bold uppercase text-slate-500">
                                        Se mostrarán todas las fechas.
                                    </div>
                                )}

                                {filtrosEdicion.periodo === 'dia' && (
                                    <input
                                        type="date"
                                        className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-indigo-500"
                                        value={filtrosEdicion.fechaInicio}
                                        onChange={(e) =>
                                            setFiltrosEdicion({
                                                ...filtrosEdicion,
                                                fechaInicio: e.target.value,
                                                fechaFin: e.target.value,
                                            })
                                        }
                                    />
                                )}

                                {filtrosEdicion.periodo === 'rango' && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="date"
                                            className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-indigo-500"
                                            value={filtrosEdicion.fechaInicio}
                                            onChange={(e) =>
                                                setFiltrosEdicion({
                                                    ...filtrosEdicion,
                                                    fechaInicio: e.target.value,
                                                })
                                            }
                                        />

                                        <input
                                            type="date"
                                            className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-indigo-500"
                                            value={filtrosEdicion.fechaFin}
                                            onChange={(e) =>
                                                setFiltrosEdicion({
                                                    ...filtrosEdicion,
                                                    fechaFin: e.target.value,
                                                })
                                            }
                                        />
                                    </div>
                                )}

                                {filtrosEdicion.periodo === 'mes' && (
                                    <input
                                        type="month"
                                        className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-indigo-500"
                                        value={filtrosEdicion.fechaInicio ? filtrosEdicion.fechaInicio.slice(0, 7) : ''}
                                        onChange={(e) => {
                                            const val = e.target.value;

                                            if (!val) return;

                                            const [y, m] = val.split('-');
                                            const ultimoDia = new Date(Number(y), Number(m), 0).getDate();

                                            setFiltrosEdicion({
                                                ...filtrosEdicion,
                                                fechaInicio: `${y}-${m}-01`,
                                                fechaFin: `${y}-${m}-${String(ultimoDia).padStart(2, '0')}`,
                                            });
                                        }}
                                    />
                                )}

                                {filtrosEdicion.periodo === 'año' && (
                                    <input
                                        type="number"
                                        min="2020"
                                        max="2035"
                                        placeholder="Año"
                                        className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:border-indigo-500"
                                        value={filtrosEdicion.fechaInicio ? filtrosEdicion.fechaInicio.slice(0, 4) : ''}
                                        onChange={(e) => {
                                            const year = e.target.value;

                                            setFiltrosEdicion({
                                                ...filtrosEdicion,
                                                fechaInicio: year ? `${year}-01-01` : '',
                                                fechaFin: year ? `${year}-12-31` : '',
                                            });
                                        }}
                                    />
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={aplicarFiltroFecha}
                                className="w-full bg-slate-800 text-white py-3 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-colors"
                            >
                                Aplicar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative z-10 w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[92vh] flex flex-col">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black uppercase text-slate-800 tracking-tighter">
                                    {isEdit ? "Editar Servicio Comisariato" : "Nuevo Servicio Comisariato"}
                                </h3>
                                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                                    Formulario de Servicio Comisariato
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={cerrarModalFormulario}
                                className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <ServicioComisariatoForm
                                isEdit={isEdit}
                                data={detalle}
                                open={showForm}
                                onSuccess={() => {
                                    cerrarModalFormulario();
                                    cargarDatos();
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            <PdfComisariato
                id={pdfId}
                onDone={handlePdfDone}
            />
        </AppLayout>
    );
}
