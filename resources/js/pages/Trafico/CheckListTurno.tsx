import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import CheckListTurnoForm from './checkListTurno/CheckListTurnoForm';
import ModalActividadesNextTurno from './checkListTurno/ModalActividadesNextTurno';
import ModalNotasOperacionales from './checkListTurno/ModalNotasOperacionales';
import ModalDetalleCheckListTurno from "./checkListTurno/ModalDetalleCheckListTurno";
import { fetchNotasOperacionales } from '@/stores/apiCheckListTurno';
import { useEffect, useState, useCallback } from 'react';
import { fetchCheckListTurno, fetchShowCheckListTurno, eliminar, fetchCheckListPendiente, validarNotaOperacional, obtenerPendientestrafico } from '@/stores/apiCheckListTurno';
import {
    Plus, ChevronLeft, ChevronRight, Edit2, CheckCircle2, AlertCircle, ClipboardList, StickyNote, ShieldCheck, Eye, Filter, X, Calendar, ChevronDown
} from 'lucide-react';
import PdfExporterTurno from './checkListTurno/sections/PdfExporterTurno';
import Swal from 'sweetalert2';

interface Role {
    slug: string;
    nombre: string;
}

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    isAdmin: boolean;
    roles: Role[];
}

interface PageProps {
    auth: {
        user: AuthUser | null;
    };
    [key: string]: any;
}

type PeriodoFiltro = 'todos' | 'dia' | 'rango' | 'mes' | 'año';

type FiltrosCheckList = {
    id: string;
    fechaInicio: string;
    fechaFin: string;
    periodo: PeriodoFiltro;
    nombre_empleado: string;
    estado: string;
};

const filtrosIniciales = (): FiltrosCheckList => ({
    id: '',
    fechaInicio: '',
    fechaFin: '',
    periodo: 'todos',
    nombre_empleado: '',
    estado: '',
});

const breadcrumbs: BreadcrumbItem[] = [{ title: 'CheckList de Turno' }];

export default function CheckListTurno() {
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [data, setData] = useState<any[]>([]);
    const [openForm, setOpenForm] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [detalle, setDetalle] = useState<any>(null);
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [idPendiente, setIdPendiente] = useState<number | null>(null);
    const [openActividades, setOpenActividades] = useState(false);
    const [isValidationMode, setIsValidationMode] = useState(false);
    const [notas, setNotas] = useState<any[]>([]);
    const [loadingNotas, setLoadingNotas] = useState(false);
    const [openNotasModal, setOpenNotasModal] = useState(false);
    const [openDetalleModal, setOpenDetalleModal] = useState(false);
    const [detalleVisualizar, setDetalleVisualizar] = useState<any>(null);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [mostrarModalFecha, setMostrarModalFecha] = useState(false);
    const [filtros, setFiltros] = useState<FiltrosCheckList>(() => filtrosIniciales());
    const [filtrosEdicion, setFiltrosEdicion] = useState<FiltrosCheckList>(() => filtrosIniciales());
    const [pendientes, setPendientes] = useState<any[]>([]);
    const [openPendientesPanel, setOpenPendientesPanel] = useState(false);
    const [loadingPendientes, setLoadingPendientes] = useState(false);

    const { auth } = usePage<{ auth: { user: any } }>().props;
    const user = auth?.user?.roles[0]?.slug;

    const formatFecha = (fecha: string) => {
        if (!fecha) return 'N/A';

        const [y, m, d] = fecha.split("T")[0].split("-");

        return new Date(Number(y), Number(m) - 1, Number(d))
            .toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "long",
                year: "numeric",
            });
    };
    const nombreRol = auth.user.roles?.[0]?.nombre;
    const cargarPendientes = async () => {
        try {
            setLoadingPendientes(true);

            const res = await obtenerPendientestrafico();

            const registros = Array.isArray(res)
                ? res
                : Array.isArray(res?.data)
                    ? res.data
                    : [];

            setPendientes(registros);
        } catch (error) {
            console.error("Error al cargar pendientes:", error);
            setPendientes([]);
        } finally {
            setLoadingPendientes(false);
        }
    };
    useEffect(() => {
        cargarPendientes();
    }, []);
    const formatFechaCorta = (fecha?: string | null) => {
        if (!fecha) return "—";

        const base = String(fecha).includes("T")
            ? String(fecha).split("T")[0]
            : String(fecha).split(" ")[0];

        const [y, m, d] = base.split("-");

        if (!y || !m || !d) return fecha;

        return `${d}/${m}/${y}`;
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

    const actualizarFiltro = (key: keyof FiltrosCheckList, value: string) => {
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

    const visualizar = async (id: number) => {
        try {
            setLoadingDetalle(true);
            setOpenDetalleModal(true);
            setDetalleVisualizar(null);

            const dat = await fetchShowCheckListTurno(id);
            setDetalleVisualizar(dat);
        } catch (error) {
            console.error(error);
            Swal.fire("Error", "No se pudo cargar la información del registro", "error");
            setOpenDetalleModal(false);
        } finally {
            setLoadingDetalle(false);
        }
    };

    const cargarNotas = async () => {
        try {
            setLoadingNotas(true);
            const res = await fetchNotasOperacionales();

            if (res.ok) {
                setNotas(res.data || []);
            }
        } catch (error) {
            console.error("Error cargando notas operacionales:", error);
        } finally {
            setLoadingNotas(false);
        }
    };

    const cargarDatos = async () => {
        try {
            setLoading(true);

            const res = await fetchCheckListTurno({
                page,
                search: '',
                per_page: 10,
                id: filtros.id,
                fechaInicio: filtros.fechaInicio,
                fechaFin: filtros.fechaFin,
                periodo: filtros.periodo,
                nombre_empleado: filtros.nombre_empleado,
                estado: filtros.estado,
            });

            setData(res.data || []);
            setMeta(res);

            const pendiente = await fetchCheckListPendiente();

            if (pendiente && pendiente.id) {
                setIdPendiente(pendiente.id);
            } else {
                setIdPendiente(null);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handlePrincipalAction = () => {
        if (idPendiente) {
            show(idPendiente);
        } else {
            setIsEdit(false);
            setDetalle(null);
            setOpenForm(true);
        }
    };

    const handlePdfDone = useCallback(() => setPdfId(null), []);

    const show = async (id: number) => {
        try {
            const dat = await fetchShowCheckListTurno(id);
            setDetalle(dat);
            setIsEdit(true);
            setOpenForm(true);
        } catch (error) {
            console.error(error);
        }
    };

    const abrirParaValidar = async (id: number) => {
        try {
            const dat = await fetchShowCheckListTurno(id);
            setDetalle(dat);
            setIsEdit(false);
            setIsValidationMode(true);
            setOpenForm(true);
        } catch (error) {
            console.error(error);
        }
    };

    const handleBack = () => {
        setOpenForm(false);
        setIsEdit(false);
        setIsValidationMode(false);
        setDetalle(null);
    };

    const cerrarFormulario = async () => {
        handleBack();
        await cargarDatos();
        await cargarNotas();
        await cargarPendientes();
    };

    const cerrarNotasModal = async () => {
        setOpenNotasModal(false);
        await cargarNotas();
        await cargarPendientes();
    };

    const cerrarDetalleModal = async () => {
        setOpenDetalleModal(false);
        setDetalleVisualizar(null);
        await cargarNotas();
        await cargarPendientes();
    };

    const cerrarActividadesModal = async () => {
        setOpenActividades(false);
        await cargarNotas();
        await cargarPendientes();
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
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false,
                    });

                    cargarDatos();
                }
            } catch (error: any) {
                Swal.fire('Error', 'No se pudo eliminar', 'error');
            }
        }
    };

    useEffect(() => {
        if (mostrarModalFecha) {
            setFiltrosEdicion({ ...filtros });
        }
    }, [mostrarModalFecha]);

    useEffect(() => {
        cargarDatos();
        cargarNotas();
    }, [page, filtros]);

    const rolUsuario = (user ?? "").toLowerCase();
    const puedeUsarBotonPrincipal = !["admin2", "fac"].includes(rolUsuario);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="CheckList de Turno" />

            <div className="p-6 bg-[#f3f4f6] min-h-screen">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                        <div className="flex items-center gap-4">
                            <div>
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                                    CheckList de Turno
                                </h2>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                    Historial y entregas
                                </p>
                            </div>

                            <button
                                onClick={async () => {
                                    await cargarNotas();
                                    setOpenNotasModal(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all active:scale-95 group relative"
                                title="Ver Notas Operacionales"
                            >
                                <StickyNote size={14} className="group-hover:rotate-12 transition-transform" />
                                <span className="text-[10px] font-black uppercase tracking-tight">Actividades</span>
                                <span className="inline-flex items-center justify-center h-5 px-1.5 text-[9px] font-black bg-indigo-600 text-white rounded-full min-w-[20px]">
                                    {loadingNotas ? '...' : notas.length}
                                </span>
                            </button>
                            {pendientes.length > 0 && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await cargarPendientes();
                                        setOpenPendientesPanel(true);
                                    }}
                                    className={`relative flex items-center gap-2 px-4 py-2 text-white rounded-lg shadow-md transition-all ${pendientes.length > 0
                                        ? 'bg-red-600 hover:bg-red-700 animate-pulse'
                                        : 'bg-slate-400 hover:bg-slate-500'
                                        }`}
                                >
                                    <span className="relative flex h-3 w-3">
                                        {pendientes.length > 0 && (
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                                        )}
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                                    </span>

                                    <span className="font-bold text-sm">
                                        PENDIENTES ({pendientes.length})
                                    </span>
                                </button>
                            )}
                        </div>

                        <div className="flex gap-2 items-center">
                            <button
                                type="button"
                                onClick={() => setFiltersOpen(!filtersOpen)}
                                className={`flex items-center gap-2 text-[10px] font-black px-4 py-2 rounded border transition-all ${filtersOpen
                                    ? 'bg-slate-800 text-white border-slate-800'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                <Filter size={14} />
                                <span>{filtersOpen ? 'OCULTAR FILTROS' : 'FILTRAR'}</span>
                            </button>

                            <button
                                onClick={() => setOpenActividades(true)}
                                className="text-[10px] font-black px-4 py-2 rounded shadow-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2"
                            >
                                <ClipboardList size={14} className="text-slate-500" />
                                AGREGAR ACTIVIDADES
                            </button>

                            {puedeUsarBotonPrincipal && (
                                <button
                                    onClick={handlePrincipalAction}
                                    className={`text-[10px] font-black px-4 py-2 rounded shadow-md transition-all active:scale-95 text-white flex items-center gap-2 ${idPendiente
                                        ? "bg-orange-500 hover:bg-orange-600 shadow-orange-100 ring-4 ring-orange-100"
                                        : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                                        }`}
                                >
                                    {idPendiente ? (
                                        <>
                                            <AlertCircle size={14} className="animate-pulse" />
                                            FINALIZAR TURNO PENDIENTE
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={14} /> NUEVO REGISTRO
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[800px]">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center w-20">
                                            ID
                                        </th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">
                                            Fecha de Registro
                                        </th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">
                                            Responsable
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
                                                placeholder="Buscar responsable..."
                                                className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center"
                                                value={filtros.nombre_empleado}
                                                onChange={(e) => actualizarFiltro('nombre_empleado', e.target.value.toUpperCase())}
                                            />
                                        </td>

                                        <td className="px-2 py-2 border-b border-slate-200">
                                            <select
                                                className="w-full text-[10px] border border-slate-200 p-1.5 rounded bg-white outline-none focus:border-blue-400 uppercase text-center font-bold text-slate-600"
                                                value={filtros.estado}
                                                onChange={(e) => actualizarFiltro('estado', e.target.value)}
                                            >
                                                <option value="">TODOS</option>
                                                <option value="finalizado">FINALIZADO</option>
                                                <option value="sin finalizar">SIN FINALIZAR</option>
                                            </select>
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
                                            <td colSpan={5} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Cargando datos...
                                            </td>
                                        </tr>
                                    ) : data.length > 0 ? (
                                        data.map((row) => {
                                            const esFinalizado = row.estado_entrega === 'finalizado';
                                            const rolUsuarioActual = (user ?? "").toLowerCase();

                                            const esAdmin = rolUsuarioActual === "admin";
                                            const esFbo = rolUsuarioActual === "fbo";
                                            const esEmpleado = rolUsuarioActual === "empleado";
                                            const esJefeArea = rolUsuarioActual === "jefe_area";
                                            const esAdmin2 = rolUsuarioActual === "admin2";
                                            const esFac = rolUsuarioActual === "fac";

                                            const puedeTodo = esAdmin || esFbo;

                                            const puedeEditar =
                                                puedeTodo ||
                                                ((esEmpleado || esJefeArea) && !esFinalizado);

                                            const puedeValidar =
                                                puedeTodo ||
                                                esEmpleado ||
                                                esJefeArea;

                                            const puedePrevisualizar =
                                                puedeTodo ||
                                                esEmpleado ||
                                                esJefeArea ||
                                                esAdmin2 ||
                                                esFac;

                                            const puedeGenerarPdf =
                                                puedeTodo ||
                                                esAdmin2 ||
                                                esFac;

                                            const puedeEliminar = puedeTodo;

                                            return (
                                                <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-4 py-4 text-center font-black text-[10px] text-slate-700">
                                                        #{row.id}
                                                    </td>

                                                    <td className="px-6 py-4 text-center">

                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-bold text-slate-400 block lowercase first-letter:uppercase">
                                                                {row.fecha ? new Date(String(row.fecha)).toLocaleDateString() : 'N/A'}
                                                            </span>
                                                            <span className="font-bold text-[10px] text-slate-800">
                                                                {row.fecha ? new Date(String(row.created_at)).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center gap-2 justify-center">
                                                            <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-600 border border-slate-200 shrink-0">
                                                                {row.nombre_empleado?.charAt(0) || '?'}
                                                            </div>
                                                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                                                                {row.nombre_empleado}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tight border ${esFinalizado
                                                            ? "bg-green-50 text-green-600 border-green-200"
                                                            : "bg-orange-50 text-orange-600 border-orange-200"
                                                            }`}>
                                                            {esFinalizado ? (
                                                                <CheckCircle2 size={12} />
                                                            ) : (
                                                                <AlertCircle size={12} className="animate-pulse" />
                                                            )}
                                                            {row.estado_entrega}
                                                        </span>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {puedeEditar && (
                                                                <button
                                                                    className={`p-2 rounded transition-colors ${esFinalizado
                                                                        ? "text-slate-400 hover:text-indigo-600"
                                                                        : "text-orange-500 hover:text-orange-600"
                                                                        }`}
                                                                    onClick={() => show(row.id)}
                                                                    title="Editar Registro"
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                            )}

                                                            {puedeValidar && !row.validado_por_user_id && (
                                                                <button
                                                                    onClick={() => abrirParaValidar(row.id)}
                                                                    className="p-2 rounded transition-colors text-slate-400 hover:text-indigo-600"
                                                                    title="Validar Registro"
                                                                >
                                                                    <ShieldCheck size={16} />
                                                                </button>
                                                            )}

                                                            {puedePrevisualizar && (
                                                                <button
                                                                    className="p-2 rounded transition-colors text-slate-400 hover:text-sky-600"
                                                                    onClick={() => visualizar(row.id)}
                                                                    title="Visualizar información"
                                                                >
                                                                    <Eye size={16} />
                                                                </button>
                                                            )}

                                                            {puedeGenerarPdf && (
                                                                <button
                                                                    className="p-2 text-slate-400 hover:text-amber-600 font-black text-[10px]"
                                                                    onClick={() => setPdfId(row.id)}
                                                                    title="Descargar PDF"
                                                                >
                                                                    PDF
                                                                </button>
                                                            )}

                                                            {puedeEliminar && (
                                                                <button
                                                                    onClick={() => handleEliminar(row.id)}
                                                                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                                                    title="Eliminar Registro"
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
                                                            )}

                                                            {!puedeEditar &&
                                                                !puedeValidar &&
                                                                !puedePrevisualizar &&
                                                                !puedeGenerarPdf &&
                                                                !puedeEliminar && (
                                                                    <span className="text-[10px] font-bold uppercase text-slate-300">
                                                                        Sin acciones
                                                                    </span>
                                                                )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
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
                                    <ChevronLeft size={14} /> ANTERIOR
                                </button>

                                <span className="px-4 text-[10px] font-black text-indigo-600 bg-indigo-50 py-2 rounded border border-indigo-100 uppercase tracking-widest">
                                    PÁGINA {meta.current_page} DE {meta.last_page}
                                </span>

                                <button
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
            {openPendientesPanel && (
                <div className="fixed inset-0 z-[120] flex justify-end">
                    <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => setOpenPendientesPanel(false)}
                    />

                    <div className="relative z-10 w-full max-w-md h-full bg-white shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-300 flex flex-col">
                        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black uppercase text-slate-800 tracking-tight">
                                    Registros pendientes
                                </h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                    Pendientes por validar: {pendientes.length}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setOpenPendientesPanel(false)}
                                className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-3">
                            {loadingPendientes ? (
                                <div className="py-20 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Cargando pendientes...
                                </div>
                            ) : pendientes.length > 0 ? (
                                pendientes.map((item) => (
                                    <div
                                        key={item.id}
                                        className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden"
                                    >
                                        <div className="p-4 space-y-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        Registro #{item.id}
                                                    </p>
                                                    <h4 className="text-sm font-black uppercase text-slate-800 leading-tight">
                                                        {item.nombre_empleado || 'Sin responsable'}
                                                    </h4>
                                                </div>

                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 text-[9px] font-black uppercase">
                                                    <AlertCircle size={12} />
                                                    Pendiente
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                                                    <p className="font-black text-slate-400 uppercase">Fecha</p>
                                                    <p className="font-bold text-slate-700">
                                                        {formatFechaCorta(item.fecha)}
                                                    </p>
                                                </div>

                                                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                                                    <p className="font-black text-slate-400 uppercase">Operaciones</p>
                                                    <p className="font-bold text-slate-700">
                                                        {item.cantidad_operaciones ?? '—'}
                                                    </p>
                                                </div>

                                                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                                                    <p className="font-black text-slate-400 uppercase">Pasajeros</p>
                                                    <p className="font-bold text-slate-700">
                                                        {item.cantidad_pasajeros ?? '—'}
                                                    </p>
                                                </div>

                                                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                                                    <p className="font-black text-slate-400 uppercase">Equipaje</p>
                                                    <p className="font-bold text-slate-700">
                                                        {item.cantidad_equipaje ?? '—'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-end gap-2 pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => visualizar(item.id)}
                                                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase flex items-center gap-1.5 transition-colors"
                                                >
                                                    <Eye size={14} />
                                                    Ver
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setOpenPendientesPanel(false);
                                                        abrirParaValidar(item.id);
                                                    }}
                                                    className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase flex items-center gap-1.5 transition-colors"
                                                >
                                                    <ShieldCheck size={14} />
                                                    Validar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-20 text-center">
                                    <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                                        <CheckCircle2 size={28} />
                                    </div>

                                    <h4 className="text-sm font-black uppercase text-slate-700">
                                        Sin pendientes
                                    </h4>

                                    <p className="text-xs font-medium text-slate-500 mt-1">
                                        No hay registros pendientes por validar.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-200 bg-slate-50">
                            <button
                                type="button"
                                onClick={async () => {
                                    await cargarPendientes();
                                }}
                                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                            >
                                Actualizar pendientes
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {mostrarModalFecha && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => setMostrarModalFecha(false)}
                    />

                    <div className="relative z-10 bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
                        <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="text-sm font-black uppercase text-slate-700">
                                Período de Fecha de Registro
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
                                        className={`flex-1 text-[10px] font-bold py-2 rounded-md transition-all uppercase ${filtrosEdicion.periodo === modo
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

            {openForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative z-10 w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black uppercase text-slate-800 tracking-tighter">
                                    {isEdit ? 'Editar Entrega de Turno' : 'Registrar Entrega de Turno'}
                                </h3>
                                <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                                    Módulo de Operaciones Diarias
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={cerrarFormulario}
                                className="p-2 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar">
                            <CheckListTurnoForm
                                isEdit={isEdit}
                                isValidationMode={isValidationMode}
                                data={detalle}
                                open={openForm}
                                onSuccess={cerrarFormulario}
                            />
                        </div>
                    </div>
                </div>
            )}

            <ModalActividadesNextTurno
                isOpen={openActividades}
                onClose={cerrarActividadesModal}
            />

            <ModalNotasOperacionales
                isOpen={openNotasModal}
                onClose={cerrarNotasModal}
                notas={notas}
                loading={loadingNotas}
                onValidar={async (id) => {
                    const result = await Swal.fire({
                        title: '¿Validar esta nota?',
                        text: "Se registrará tu usuario como el validador de esta incidencia.",
                        icon: 'info',
                        showCancelButton: true,
                        confirmButtonColor: '#4f46e5',
                        cancelButtonColor: '#64748b',
                        confirmButtonText: 'Sí, validar',
                        cancelButtonText: 'Cancelar',
                    });

                    if (result.isConfirmed) {
                        try {
                            const res = await validarNotaOperacional(id);

                            if (res.ok) {
                                Swal.fire({
                                    title: '¡Validada!',
                                    icon: 'success',
                                    timer: 1500,
                                    showConfirmButton: false,
                                });

                                cargarNotas();
                            }
                        } catch (error) {
                            Swal.fire('Error', 'No se pudo validar la nota', 'error');
                        }
                    }
                }}
            />

            <ModalDetalleCheckListTurno
                isOpen={openDetalleModal}
                onClose={cerrarDetalleModal}
                data={detalleVisualizar}
                loading={loadingDetalle}
            />

            <PdfExporterTurno id={pdfId} onDone={handlePdfDone} />
        </AppLayout>
    );
}
