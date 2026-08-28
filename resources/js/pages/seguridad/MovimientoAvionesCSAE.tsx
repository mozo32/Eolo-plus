import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import MovimientoCSAEForm from './MovimientoAvionesCSAE/MovimientoCSAEForm';
import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    fetchMovimientoCSAE,
    fetchShowMovimientoCSAE,
    fetchAeronavesPendientesCSAE,
    eliminar,
    type AeronavePendienteCSAE,
} from '@/stores/apiMovimientoCSAE';
import {
    Search,
    Plane,
    X,
    Edit2,
    Plus,
    Filter,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Calendar,
    CheckCircle2,
    AlertCircle,
    LogOut,
    Eye,
    Trash2,
} from 'lucide-react';
import PdfCsae from './MovimientoAvionesCSAE/PdfCsae';
import Swal from 'sweetalert2';
import AeronavesPendientesCSAE from './MovimientoAvionesCSAE/AeronavesPendientesCSAE';
import VistaPreviaCsae from './MovimientoAvionesCSAE/VistaPreviaCsae';

type Role = { slug: string; nombre: string; };
export type AuthUser = { id: number; name: string; email: string; isAdmin: boolean; roles: Role[]; };
type PageProps = { auth: { user: AuthUser | null; }; };
type ModoPeriodoCSAE = 'dia' | 'rango' | 'mes' | 'año';

type ValorPeriodoCSAE = {
    periodo: ModoPeriodoCSAE;
    fechaInicio: string;
    fechaFin: string;
};

type FiltroPeriodoCSAEProps = {
    titulo: string;
    value: ValorPeriodoCSAE;
    onChange: (value: ValorPeriodoCSAE) => void;
};

const crearPeriodoVacio = (): ValorPeriodoCSAE => ({
    periodo: 'dia',
    fechaInicio: '',
    fechaFin: '',
});

const obtenerFechaHoy = () =>
    new Date().toLocaleDateString('en-CA');

const formatearFechaFiltro = (fecha: string) => {
    const [anio, mes, dia] = fecha.split('-');

    return anio && mes && dia
        ? `${dia}/${mes}/${anio}`
        : fecha;
};

const meses = [
    'ENERO',
    'FEBRERO',
    'MARZO',
    'ABRIL',
    'MAYO',
    'JUNIO',
    'JULIO',
    'AGOSTO',
    'SEPTIEMBRE',
    'OCTUBRE',
    'NOVIEMBRE',
    'DICIEMBRE',
];

function FiltroPeriodoCSAE({
    titulo,
    value,
    onChange,
}: FiltroPeriodoCSAEProps) {
    const [abierto, setAbierto] = useState(false);
    const [borrador, setBorrador] = useState<ValorPeriodoCSAE>(crearPeriodoVacio);
    const abrir = () => {
        const hoy = obtenerFechaHoy();

        setBorrador(
            value.fechaInicio
                ? { ...value }
                : {
                    periodo: 'dia',
                    fechaInicio: hoy,
                    fechaFin: hoy,
                },
        );

        setAbierto(true);
    };

    const cambiarPeriodo = (periodo: ModoPeriodoCSAE) => {
        const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(
            borrador.fechaInicio,
        );

        const base = fechaValida
            ? borrador.fechaInicio
            : obtenerFechaHoy();

        const [anioTexto, mesTexto] = base.split('-');
        const anio = Number(anioTexto);
        const mes = Number(mesTexto);
        const mesFormateado = String(mes).padStart(2, '0');

        if (periodo === 'dia') {
            setBorrador({
                periodo,
                fechaInicio: base,
                fechaFin: base,
            });

            return;
        }

        if (periodo === 'mes') {
            const ultimoDia = new Date(anio, mes, 0).getDate();

            setBorrador({
                periodo,
                fechaInicio: `${anio}-${mesFormateado}-01`,
                fechaFin: `${anio}-${mesFormateado}-${String(
                    ultimoDia,
                ).padStart(2, '0')}`,
            });

            return;
        }

        if (periodo === 'año') {
            setBorrador({
                periodo,
                fechaInicio: `${anio}-01-01`,
                fechaFin: `${anio}-12-31`,
            });

            return;
        }

        setBorrador({
            periodo,
            fechaInicio: base,
            fechaFin:
                borrador.fechaFin &&
                borrador.fechaFin >= base
                    ? borrador.fechaFin
                    : base,
        });
    };

    const seleccionarMes = (valor: string) => {
        if (!valor) {
            setBorrador((actual) => ({
                ...actual,
                fechaInicio: '',
                fechaFin: '',
            }));

            return;
        }

        const [anioTexto, mesTexto] = valor.split('-');
        const anio = Number(anioTexto);
        const mes = Number(mesTexto);
        const ultimoDia = new Date(anio, mes, 0).getDate();

        setBorrador({
            periodo: 'mes',
            fechaInicio: `${valor}-01`,
            fechaFin: `${valor}-${String(ultimoDia).padStart(
                2,
                '0',
            )}`,
        });
    };

    const seleccionarAnio = (anio: string) => {
        if (!/^\d{4}$/.test(anio)) {
            setBorrador((actual) => ({
                ...actual,
                fechaInicio: '',
                fechaFin: '',
            }));

            return;
        }

        setBorrador({
            periodo: 'año',
            fechaInicio: `${anio}-01-01`,
            fechaFin: `${anio}-12-31`,
        });
    };

    const puedeAplicar =
        /^\d{4}-\d{2}-\d{2}$/.test(borrador.fechaInicio) &&
        /^\d{4}-\d{2}-\d{2}$/.test(borrador.fechaFin) &&
        borrador.fechaInicio <= borrador.fechaFin;

    const obtenerEtiqueta = () => {
        if (!value.fechaInicio) {
            return titulo;
        }

        if (value.periodo === 'dia') {
            return formatearFechaFiltro(value.fechaInicio);
        }

        if (value.periodo === 'rango') {
            return `${formatearFechaFiltro(
                value.fechaInicio,
            )} / ${formatearFechaFiltro(value.fechaFin)}`;
        }

        if (value.periodo === 'mes') {
            const anio = value.fechaInicio.substring(0, 4);
            const mes = Number(
                value.fechaInicio.substring(5, 7),
            );

            return `${meses[mes - 1]} ${anio}`;
        }

        return `AÑO ${value.fechaInicio.substring(0, 4)}`;
    };

    return (
        <>
            <button
                type="button"
                onClick={abrir}
                className="flex w-full items-center justify-between rounded border border-slate-200 bg-white p-1.5 text-[10px] shadow-sm transition-colors hover:border-blue-400"
            >
                <div className="flex min-w-0 items-center gap-1">
                    <Calendar
                        size={12}
                        className="shrink-0 text-blue-500"
                    />

                    <span className="truncate font-bold uppercase text-slate-600">
                        {obtenerEtiqueta()}
                    </span>
                </div>

                <ChevronDown
                    size={12}
                    className="shrink-0 text-slate-400"
                />
            </button>

            {abierto &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setAbierto(false)}
                        />

                        <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
                                <h3 className="text-sm font-black uppercase text-slate-700">
                                    Período: {titulo}
                                </h3>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setAbierto(false)
                                    }
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="space-y-4 p-4">
                                <div className="flex rounded-lg bg-slate-100 p-1">
                                    {(
                                        [
                                            'dia',
                                            'rango',
                                            'mes',
                                            'año',
                                        ] as ModoPeriodoCSAE[]
                                    ).map((modo) => (
                                        <button
                                            type="button"
                                            key={modo}
                                            onClick={() =>
                                                cambiarPeriodo(
                                                    modo,
                                                )
                                            }
                                            className={`flex-1 rounded-md py-2 text-[10px] font-bold uppercase transition-all ${
                                                borrador.periodo ===
                                                modo
                                                    ? 'bg-white text-blue-600 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        >
                                            {modo}
                                        </button>
                                    ))}
                                </div>

                                {borrador.periodo === 'dia' && (
                                    <input
                                        type="date"
                                        value={
                                            borrador.fechaInicio
                                        }
                                        onChange={(e) =>
                                            setBorrador({
                                                ...borrador,
                                                fechaInicio:
                                                    e.target
                                                        .value,
                                                fechaFin:
                                                    e.target
                                                        .value,
                                            })
                                        }
                                        className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                                    />
                                )}

                                {borrador.periodo ===
                                    'rango' && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="date"
                                            value={
                                                borrador.fechaInicio
                                            }
                                            onChange={(e) =>
                                                setBorrador({
                                                    ...borrador,
                                                    fechaInicio:
                                                        e.target
                                                            .value,
                                                })
                                            }
                                            className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                                        />

                                        <input
                                            type="date"
                                            value={
                                                borrador.fechaFin
                                            }
                                            min={
                                                borrador.fechaInicio
                                            }
                                            onChange={(e) =>
                                                setBorrador({
                                                    ...borrador,
                                                    fechaFin:
                                                        e.target
                                                            .value,
                                                })
                                            }
                                            className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                                        />
                                    </div>
                                )}

                                {borrador.periodo === 'mes' && (
                                    <input
                                        type="month"
                                        value={borrador.fechaInicio.substring(
                                            0,
                                            7,
                                        )}
                                        onChange={(e) =>
                                            seleccionarMes(
                                                e.target.value,
                                            )
                                        }
                                        className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                                    />
                                )}

                                {borrador.periodo === 'año' && (
                                    <input
                                        key={`${borrador.periodo}-${abierto}`}
                                        type="number"
                                        min="2000"
                                        max="2100"
                                        defaultValue={borrador.fechaInicio.substring(
                                            0,
                                            4,
                                        )}
                                        onChange={(e) =>
                                            seleccionarAnio(
                                                e.target.value,
                                            )
                                        }
                                        placeholder="Año"
                                        className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                                    />
                                )}

                                <div className="flex gap-2">
                                    {value.fechaInicio && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onChange(
                                                    crearPeriodoVacio(),
                                                );

                                                setAbierto(
                                                    false,
                                                );
                                            }}
                                            className="flex-1 rounded-lg border border-red-200 py-3 text-[10px] font-black uppercase text-red-600 hover:bg-red-50"
                                        >
                                            Quitar filtro
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        disabled={
                                            !puedeAplicar
                                        }
                                        onClick={() => {
                                            onChange({
                                                ...borrador,
                                            });

                                            setAbierto(false);
                                        }}
                                        className="flex-1 rounded-lg bg-slate-800 py-3 text-[10px] font-black uppercase tracking-widest text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        Aplicar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}
        </>
    );
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Movimiento Aviones CSAE' },
];

export default function MovimientoAvionesCSAE() {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;
    const rolesUsuario = new Set(
        (user?.roles ?? []).map((role) => role.slug.trim().toLowerCase()),
    );
    const tieneRol = (...roles: string[]) =>
        roles.some((role) => rolesUsuario.has(role));
    const puedeGestionarTodo = tieneRol('admin', 'fbo');
    const permisosAcciones = {
        vistaPrevia:
            puedeGestionarTodo ||
            tieneRol('empleado', 'jefe_area', 'admin2', 'fac'),
        registrarSalida:
            puedeGestionarTodo || tieneRol('empleado', 'jefe_area'),
        editar: puedeGestionarTodo,
        pdf: puedeGestionarTodo || tieneRol('admin2', 'fac'),
        eliminar: puedeGestionarTodo,
    };

    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [tipoAeronave, setTipoAeronave] = useState('');
    const [filtroFechaEntrada, setFiltroFechaEntrada] =
        useState<ValorPeriodoCSAE>(crearPeriodoVacio);
    const [filtroFechaSalida, setFiltroFechaSalida] =
        useState<ValorPeriodoCSAE>(crearPeriodoVacio);
    const [estado, setEstado] =
        useState<'' | 'pendiente' | 'salio'>('');
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
    const [pendientesOpen, setPendientesOpen] =
        useState(false);
    const [aeronavesPendientes, setAeronavesPendientes] =
        useState<AeronavePendienteCSAE[]>([]);
    const [previewId, setPreviewId] =
        useState<number | null>(null);
    const [loadingPendientes, setLoadingPendientes] =
        useState(false);
    const [errorPendientes, setErrorPendientes] =
        useState<string | null>(null);

    const formatFecha = (fecha?: string | null) => {
        if (!fecha) {
            return '—';
        }

        const base = String(fecha).includes('T')
            ? String(fecha).split('T')[0]
            : String(fecha).split(' ')[0];

        const [y, m, d] = base.split('-');

        if (!y || !m || !d) {
            return fecha;
        }

        return `${d}/${m}/${y}`;
    };

    const formatHora = (fecha?: string | null) => {
        if (!fecha) {
            return '';
        }

        const date = new Date(fecha);

        if (Number.isNaN(date.getTime())) {
            return '';
        }

        return date.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    };

    const registroYaSalio = (row: any) => {
        return (
            row.ya_salio === true ||
            row.ya_salio === 1 ||
            row.ya_salio === '1'
        );
    };

    const cargarDatos = async () => {
        try {
            setLoading(true);

            const res = await fetchMovimientoCSAE({
                page,
                search,
                tipo_aeronave: tipoAeronave,
                entrada_inicio:
                    filtroFechaEntrada.fechaInicio,
                entrada_fin: filtroFechaEntrada.fechaFin,
                salida_inicio:
                    filtroFechaSalida.fechaInicio,
                salida_fin: filtroFechaSalida.fechaFin,
                estado,
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

            const response =
                await fetchAeronavesPendientesCSAE();

            setAeronavesPendientes(
                response.aeronaves || [],
            );
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
            const dat =
                await fetchShowMovimientoCSAE(id);

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
            const dat =
                await fetchShowMovimientoCSAE(id);

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
        setTipoAeronave('');
        setFiltroFechaEntrada(crearPeriodoVacio());
        setFiltroFechaSalida(crearPeriodoVacio());
        setEstado('');
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

        if (!result.isConfirmed) {
            return;
        }

        try {
            const res = await eliminar(id);

            if (!res.ok) {
                throw new Error(
                    res.message || 'Error al eliminar',
                );
            }

            await Swal.fire({
                title: '¡Eliminado!',
                text: 'El registro ha sido borrado con éxito.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
            });

            await cargarDatos();
        } catch (error: any) {
            await Swal.fire(
                'Error',
                error.message ||
                    'No se pudo eliminar el registro',
                'error',
            );
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            cargarDatos();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [
        page,
        search,
        tipoAeronave,
        filtroFechaEntrada,
        filtroFechaSalida,
        estado,
    ]);

    const handlePdfDone = useCallback(() => {
        setPdfId(null);
    }, []);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Movimiento de Aviones CSAE" />

            <div className="min-h-screen bg-[#f3f4f6] p-6">
                <div className="animate-in space-y-4 fade-in duration-500">
                    <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
                        <div className="flex items-center gap-3">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tighter text-slate-800">
                                    Movimiento de Aeronaves
                                </h2>

                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Registro de entradas y salidas CSAE
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={abrirPanelPendientes}
                                className="relative flex animate-pulse items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white shadow-md transition-all hover:bg-red-700"
                            >
                                <span className="flex h-3 w-3">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                                    <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                                </span>

                                <span className="text-sm font-bold">
                                    PENDIENTES (
                                    {
                                        aeronavesPendientes.length
                                    }
                                    )
                                </span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    setFiltersOpen(
                                        !filtersOpen,
                                    )
                                }
                                className={`flex items-center gap-2 rounded border px-4 py-2 text-[10px] font-black transition-all ${
                                    filtersOpen
                                        ? 'border-slate-800 bg-slate-800 text-white'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <Filter size={14} />

                                <span>
                                    {filtersOpen
                                        ? 'OCULTAR FILTROS'
                                        : 'FILTRAR'}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={abrirNuevo}
                                className="flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-[10px] font-black text-white shadow-md shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
                            >
                                <Plus size={14} />
                                NUEVO REGISTRO
                            </button>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="custom-scrollbar overflow-x-auto">
                            <table className="w-full min-w-[900px] border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-white">
                                        <th className="w-20 px-4 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            ID
                                        </th>

                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Matrícula
                                        </th>

                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Tipo Aeronave
                                        </th>

                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Entrada
                                        </th>

                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Salida
                                        </th>

                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Estado
                                        </th>

                                        <th className="px-6 py-4 text-right text-[9px] font-black uppercase text-slate-400">
                                            Acciones
                                        </th>
                                    </tr>

                                    <tr
                                        className={`bg-slate-50 transition-all duration-300 ease-in-out ${
                                            filtersOpen
                                                ? 'opacity-100'
                                                : 'hidden opacity-0'
                                        }`}
                                    >
                                        <td className="border-b border-slate-200 px-2 py-2" />

                                        <td className="border-b border-slate-200 px-2 py-2">
                                            <div className="relative">
                                                <Search
                                                    className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
                                                    size={13}
                                                />

                                                <input
                                                    type="text"
                                                    placeholder="Buscar matrícula..."
                                                    value={
                                                        search
                                                    }
                                                    onChange={(
                                                        e,
                                                    ) => {
                                                        setPage(
                                                            1,
                                                        );

                                                        setSearch(
                                                            e.target.value.toUpperCase(),
                                                        );
                                                    }}
                                                    className="w-full rounded border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-center text-[10px] uppercase outline-none focus:border-blue-400"
                                                />
                                            </div>
                                        </td>

                                        <td className="border-b border-slate-200 px-2 py-2">
                                            <input
                                                type="text"
                                                placeholder="Tipo aeronave..."
                                                value={
                                                    tipoAeronave
                                                }
                                                onChange={(
                                                    e,
                                                ) => {
                                                    setPage(1);

                                                    setTipoAeronave(
                                                        e.target.value.toUpperCase(),
                                                    );
                                                }}
                                                className="w-full rounded border border-slate-200 bg-white p-1.5 text-center text-[10px] uppercase outline-none focus:border-blue-400"
                                            />
                                        </td>

                                        <td className="border-b border-slate-200 px-2 py-2">
                                            <FiltroPeriodoCSAE
                                                titulo="Fecha entrada"
                                                value={
                                                    filtroFechaEntrada
                                                }
                                                onChange={(
                                                    value,
                                                ) => {
                                                    setPage(1);

                                                    setFiltroFechaEntrada(
                                                        value,
                                                    );
                                                }}
                                            />
                                        </td>

                                        <td className="border-b border-slate-200 px-2 py-2">
                                            <FiltroPeriodoCSAE
                                                titulo="Fecha salida"
                                                value={
                                                    filtroFechaSalida
                                                }
                                                onChange={(
                                                    value,
                                                ) => {
                                                    setPage(1);

                                                    setFiltroFechaSalida(
                                                        value,
                                                    );
                                                }}
                                            />
                                        </td>

                                        <td className="border-b border-slate-200 px-2 py-2">
                                            <select
                                                value={estado}
                                                onChange={(
                                                    e,
                                                ) => {
                                                    setPage(1);

                                                    setEstado(
                                                        e.target
                                                            .value as
                                                            | ''
                                                            | 'pendiente'
                                                            | 'salio',
                                                    );
                                                }}
                                                className="w-full rounded border border-slate-200 bg-white p-1.5 text-center text-[10px] font-bold uppercase outline-none focus:border-blue-400"
                                            >
                                                <option value="">
                                                    Todos
                                                </option>

                                                <option value="pendiente">
                                                    En plataforma
                                                </option>

                                                <option value="salio">
                                                    Ya salió
                                                </option>
                                            </select>
                                        </td>

                                        <td className="border-b border-slate-200 px-2 py-2 text-right">
                                            <button
                                                type="button"
                                                onClick={
                                                    limpiarFiltros
                                                }
                                                className="p-1.5 text-slate-400 transition-colors hover:text-red-500"
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
                                                colSpan={7}
                                                className="px-6 py-20 text-center text-[10px] font-black uppercase tracking-widest text-slate-400"
                                            >
                                                Cargando datos...
                                            </td>
                                        </tr>
                                    ) : data.length > 0 ? (
                                        data.map((row) => {
                                            const salio =
                                                registroYaSalio(
                                                    row,
                                                );

                                            return (
                                                <tr
                                                    key={
                                                        row.id
                                                    }
                                                    className={`border-b border-slate-50 transition-colors ${
                                                        salio
                                                            ? 'hover:bg-green-50/40'
                                                            : 'bg-orange-50/30 hover:bg-orange-50/60'
                                                    }`}
                                                >
                                                    <td className="px-4 py-4 text-center text-[10px] font-black text-slate-700">
                                                        #
                                                        {
                                                            row.id
                                                        }
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div
                                                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                                                    salio
                                                                        ? 'border-green-100 bg-green-50 text-green-600'
                                                                        : 'border-orange-100 bg-orange-50 text-orange-600'
                                                                }`}
                                                            >
                                                                <Plane
                                                                    size={
                                                                        13
                                                                    }
                                                                />
                                                            </div>

                                                            <span className="text-[11px] font-bold uppercase tracking-tight text-slate-600">
                                                                {row.matricula ||
                                                                    '—'}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-tight text-slate-600">
                                                            {row.tipo_aeronave ||
                                                                '—'}
                                                        </span>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex flex-col">
                                                            <span className="block text-[9px] font-bold uppercase text-slate-400">
                                                                {formatFecha(
                                                                    row.fecha_hora_entrada,
                                                                )}
                                                            </span>

                                                            <span className="text-[10px] font-bold text-slate-800">
                                                                {formatHora(
                                                                    row.fecha_hora_entrada,
                                                                )}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        {salio ? (
                                                            <div className="flex flex-col">
                                                                <span className="block text-[9px] font-bold uppercase text-slate-400">
                                                                    {formatFecha(
                                                                        row.fecha_hora_salida,
                                                                    )}
                                                                </span>

                                                                <span className="text-[10px] font-bold text-slate-800">
                                                                    {formatHora(
                                                                        row.fecha_hora_salida,
                                                                    )}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-tight text-orange-600">
                                                                <AlertCircle
                                                                    size={
                                                                        12
                                                                    }
                                                                    className="animate-pulse"
                                                                />
                                                                Pendiente
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <span
                                                            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-[10px] font-black uppercase tracking-tight ${
                                                                salio
                                                                    ? 'border-green-200 bg-green-50 text-green-600'
                                                                    : 'border-orange-200 bg-orange-50 text-orange-600'
                                                            }`}
                                                        >
                                                            {salio ? (
                                                                <>
                                                                    <CheckCircle2
                                                                        size={
                                                                            12
                                                                        }
                                                                    />
                                                                    Ya
                                                                    salió
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <AlertCircle
                                                                        size={
                                                                            12
                                                                        }
                                                                        className="animate-pulse"
                                                                    />
                                                                    En
                                                                    plataforma
                                                                </>
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {permisosAcciones.vistaPrevia && (
                                                                <button
                                                                    type="button"
                                                                    className="rounded p-2 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600"
                                                                    onClick={() => setPreviewId(row.id)}
                                                                    title="Vista previa"
                                                                >
                                                                    <Eye size={16} />
                                                                </button>
                                                            )}

                                                            {permisosAcciones.registrarSalida && !salio && (
                                                                <button
                                                                    type="button"
                                                                    className="rounded p-2 text-slate-400 transition-colors hover:text-orange-600"
                                                                    onClick={() => abrirSalida(row.id)}
                                                                    title="Registrar salida"
                                                                >
                                                                    <LogOut size={16} />
                                                                </button>
                                                            )}

                                                            {permisosAcciones.editar && (
                                                                <button
                                                                    type="button"
                                                                    className="rounded p-2 text-slate-400 transition-colors hover:text-indigo-600"
                                                                    onClick={() => show(row.id)}
                                                                    title={salio ? 'Ver o editar registro' : 'Editar entrada'}
                                                                >
                                                                    <Edit2 size={16} />
                                                                </button>
                                                            )}

                                                            {permisosAcciones.pdf && (
                                                                <button
                                                                    type="button"
                                                                    className="p-2 text-[10px] font-black text-slate-400 hover:text-amber-600"
                                                                    title="Descargar PDF"
                                                                    onClick={() => setPdfId(row.id)}
                                                                >
                                                                    PDF
                                                                </button>
                                                            )}

                                                            {permisosAcciones.eliminar && (
                                                                <button
                                                                    type="button"
                                                                    className="p-2 text-slate-400 transition-colors hover:text-red-600"
                                                                    title="Eliminar"
                                                                    onClick={() => handleEliminar(row.id)}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="px-6 py-20 text-center text-[10px] font-black uppercase tracking-widest text-slate-400"
                                            >
                                                No hay registros
                                                disponibles
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {meta && meta.last_page > 1 && (
                        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                Mostrando {meta.from || 0} -{' '}
                                {meta.to || 0} de{' '}
                                {meta.total || 0}
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    disabled={page === 1}
                                    onClick={() =>
                                        setPage(page - 1)
                                    }
                                    className="flex items-center gap-1 rounded border border-slate-200 px-4 py-2 text-[10px] font-black transition-colors hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <ChevronLeft size={14} />
                                    ANTERIOR
                                </button>

                                <span className="rounded border border-indigo-100 bg-indigo-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600">
                                    PÁGINA{' '}
                                    {meta.current_page} DE{' '}
                                    {meta.last_page}
                                </span>

                                <button
                                    disabled={
                                        page ===
                                        meta.last_page
                                    }
                                    onClick={() =>
                                        setPage(page + 1)
                                    }
                                    className="flex items-center gap-1 rounded border border-slate-200 px-4 py-2 text-[10px] font-black transition-colors hover:bg-slate-50 disabled:opacity-50"
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
                <div className="animate-in fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm fade-in duration-300">
                    <div className="animate-in relative z-10 flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl zoom-in-95 duration-300">
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
                                    Módulo de movimiento de
                                    aeronaves
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

                        <div className="custom-scrollbar overflow-y-auto bg-[#f8fafc]">
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

            <PdfCsae
                id={pdfId}
                onDone={handlePdfDone}
            />

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
