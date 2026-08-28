import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, BellRing, Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Filter, Hash, LogOut, PenTool, Plus, Search, User, X } from "lucide-react";
import Swal from "sweetalert2";
import RegistroVisitantesForm from "./RegistroVisitantesFrom";
import {
    guardarSalida,
    listaRegistroVisitantes,
    listaVisitantesPendientes,
    type MetaPaginacion,
} from "@/stores/apiRegistroVisitantes";
import FirmaCanvas from "@/pages/FirmaCanvas";

interface Visitante {
    id: number;
    nombre: string;
    procedencia: string;
    fecha_entrada: string;
    hora_entrada: string;
    fecha_salida?: string | null;
    hora_salida?: string | null;
    gafete: string;
    tipo_gafete?: "Rojo" | "Verde" | null;
}

const obtenerFechaActual = () => new Date().toLocaleDateString("en-CA");
const REGISTROS_POR_PAGINA = 10;

type ModoPeriodo = "dia" | "rango" | "mes" | "año";

type PeriodoFecha = {
    periodo: ModoPeriodo;
    fechaInicio: string;
    fechaFin: string;
};

const crearPeriodoVacio = (): PeriodoFecha => ({
    periodo: "dia",
    fechaInicio: "",
    fechaFin: "",
});

const crearPeriodoActual = (): PeriodoFecha => {
    const hoy = obtenerFechaActual();

    return {
        periodo: "dia",
        fechaInicio: hoy,
        fechaFin: hoy,
    };
};

const formatearFecha = (fecha?: string | null) => {
    if (!fecha) return "—";

    const fechaLimpia = String(fecha).split("T")[0].split(" ")[0];
    const [anio, mes, dia] = fechaLimpia.split("-");

    return anio && mes && dia
        ? `${dia}/${mes}/${anio}`
        : String(fecha);
};

const formatearHora = (hora?: string | null) => {
    if (!hora) return "—";

    const texto = String(hora);
    const coincidencia = texto.match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);

    return coincidencia
        ? `${coincidencia[1].padStart(2, "0")}:${coincidencia[2]}`
        : texto;
};

const nombresMeses = [
    "ENERO",
    "FEBRERO",
    "MARZO",
    "ABRIL",
    "MAYO",
    "JUNIO",
    "JULIO",
    "AGOSTO",
    "SEPTIEMBRE",
    "OCTUBRE",
    "NOVIEMBRE",
    "DICIEMBRE",
];

function FiltroPeriodoVisitantes({
    value,
    onChange,
}: {
    value: PeriodoFecha;
    onChange: (value: PeriodoFecha) => void;
}) {
    const [abierto, setAbierto] = useState(false);
    const [borrador, setBorrador] = useState<PeriodoFecha>(crearPeriodoActual);

    const abrir = () => {
        setBorrador(value.fechaInicio ? { ...value } : crearPeriodoActual());
        setAbierto(true);
    };

    const cambiarPeriodo = (periodo: ModoPeriodo) => {
        const hoy = obtenerFechaActual();
        const [anioTexto, mesTexto] = hoy.split("-");
        const anio = Number(anioTexto);
        const mes = Number(mesTexto);

        if (periodo === "dia" || periodo === "rango") {
            setBorrador({ periodo, fechaInicio: hoy, fechaFin: hoy });
            return;
        }

        if (periodo === "mes") {
            const ultimoDia = new Date(anio, mes, 0).getDate();

            setBorrador({
                periodo,
                fechaInicio: `${anioTexto}-${mesTexto}-01`,
                fechaFin: `${anioTexto}-${mesTexto}-${String(ultimoDia).padStart(2, "0")}`,
            });
            return;
        }

        setBorrador({
            periodo,
            fechaInicio: `${anioTexto}-01-01`,
            fechaFin: `${anioTexto}-12-31`,
        });
    };

    const seleccionarMes = (valor: string) => {
        if (!valor) {
            setBorrador((actual) => ({ ...actual, fechaInicio: "", fechaFin: "" }));
            return;
        }

        const [anioTexto, mesTexto] = valor.split("-");
        const ultimoDia = new Date(Number(anioTexto), Number(mesTexto), 0).getDate();

        setBorrador({
            periodo: "mes",
            fechaInicio: `${valor}-01`,
            fechaFin: `${valor}-${String(ultimoDia).padStart(2, "0")}`,
        });
    };

    const seleccionarAnio = (anio: string) => {
        if (!/^\d{4}$/.test(anio)) {
            setBorrador((actual) => ({ ...actual, fechaInicio: "", fechaFin: "" }));
            return;
        }

        setBorrador({
            periodo: "año",
            fechaInicio: `${anio}-01-01`,
            fechaFin: `${anio}-12-31`,
        });
    };

    const puedeAplicar =
        /^\d{4}-\d{2}-\d{2}$/.test(borrador.fechaInicio) &&
        /^\d{4}-\d{2}-\d{2}$/.test(borrador.fechaFin) &&
        borrador.fechaInicio <= borrador.fechaFin;

    const obtenerEtiqueta = () => {
        if (!value.fechaInicio) return "Fecha de entrada";
        if (value.periodo === "dia") return formatearFecha(value.fechaInicio);

        if (value.periodo === "rango") {
            return `${formatearFecha(value.fechaInicio)} / ${formatearFecha(value.fechaFin)}`;
        }

        if (value.periodo === "mes") {
            const anio = value.fechaInicio.substring(0, 4);
            const mes = Number(value.fechaInicio.substring(5, 7));
            return `${nombresMeses[mes - 1]} ${anio}`;
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
                <span className="flex min-w-0 items-center gap-1">
                    <Calendar size={12} className="shrink-0 text-blue-500" />
                    <span className="truncate font-bold uppercase text-slate-600">
                        {obtenerEtiqueta()}
                    </span>
                </span>
                <ChevronDown size={12} className="shrink-0 text-slate-400" />
            </button>

            {abierto &&
                typeof document !== "undefined" &&
                createPortal(
                    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
                        <button
                            type="button"
                            aria-label="Cerrar filtro"
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setAbierto(false)}
                        />

                        <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
                                <h3 className="text-sm font-black uppercase text-slate-700">
                                    Período: fecha de entrada
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setAbierto(false)}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="space-y-4 p-4">
                                <div className="flex rounded-lg bg-slate-100 p-1">
                                    {(["dia", "rango", "mes", "año"] as ModoPeriodo[]).map((modo) => (
                                        <button
                                            type="button"
                                            key={modo}
                                            onClick={() => cambiarPeriodo(modo)}
                                            className={`flex-1 rounded-md py-2 text-[10px] font-bold uppercase transition-all ${borrador.periodo === modo ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                                        >
                                            {modo}
                                        </button>
                                    ))}
                                </div>

                                {borrador.periodo === "dia" && (
                                    <input
                                        type="date"
                                        value={borrador.fechaInicio}
                                        onChange={(event) =>
                                            setBorrador({
                                                periodo: "dia",
                                                fechaInicio: event.target.value,
                                                fechaFin: event.target.value,
                                            })
                                        }
                                        className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                                    />
                                )}

                                {borrador.periodo === "rango" && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="date"
                                            value={borrador.fechaInicio}
                                            onChange={(event) =>
                                                setBorrador((actual) => ({
                                                    ...actual,
                                                    fechaInicio: event.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                                        />
                                        <input
                                            type="date"
                                            value={borrador.fechaFin}
                                            min={borrador.fechaInicio}
                                            onChange={(event) =>
                                                setBorrador((actual) => ({
                                                    ...actual,
                                                    fechaFin: event.target.value,
                                                }))
                                            }
                                            className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                                        />
                                    </div>
                                )}

                                {borrador.periodo === "mes" && (
                                    <input
                                        type="month"
                                        value={borrador.fechaInicio.substring(0, 7)}
                                        onChange={(event) => seleccionarMes(event.target.value)}
                                        className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                                    />
                                )}

                                {borrador.periodo === "año" && (
                                    <input
                                        key={`${borrador.periodo}-${abierto}`}
                                        type="number"
                                        min="2000"
                                        max="2100"
                                        defaultValue={borrador.fechaInicio.substring(0, 4)}
                                        onChange={(event) => seleccionarAnio(event.target.value)}
                                        placeholder="Año"
                                        className="w-full rounded-lg border border-slate-200 p-2 text-sm"
                                    />
                                )}

                                <div className="flex gap-2">
                                    {value.fechaInicio && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onChange(crearPeriodoVacio());
                                                setAbierto(false);
                                            }}
                                            className="flex-1 rounded-lg border border-red-200 py-3 text-[10px] font-black uppercase text-red-600 hover:bg-red-50"
                                        >
                                            Quitar filtro
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        disabled={!puedeAplicar}
                                        onClick={() => {
                                            onChange({ ...borrador });
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

const clasesTipoGafete = (tipo?: Visitante["tipo_gafete"]) => {
    if (tipo === "Rojo") {
        return "border-red-200 bg-red-50 text-red-700";
    }

    if (tipo === "Verde") {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }

    return "border-slate-200 bg-slate-50 text-slate-500";
};

const colorPuntoTipoGafete = (tipo?: Visitante["tipo_gafete"]) => {
    if (tipo === "Rojo") return "bg-red-500";
    if (tipo === "Verde") return "bg-emerald-500";
    return "bg-slate-400";
};

function FirmaSalidaBox({
    value,
    onClick,
    disabled = false,
}: {
    value?: string;
    onClick: () => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="group relative flex h-48 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-200 bg-white transition-all hover:border-blue-400 hover:bg-blue-50/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
            {value ? (
                <>
                    <img
                        src={value}
                        alt="Firma de salida del visitante"
                        className="h-full w-full object-contain p-4"
                    />
                    <span className="absolute bottom-2 right-2 rounded bg-blue-600 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white shadow-sm">
                        Presione para cambiar
                    </span>
                </>
            ) : (
                <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full bg-slate-50 p-3 shadow-sm transition-colors group-hover:bg-blue-100">
                        <PenTool className="text-slate-400 transition-colors group-hover:text-blue-600" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-blue-600">
                        Capturar firma de salida
                    </span>
                    <span className="text-[9px] font-bold text-slate-300">
                        Presione para abrir el panel
                    </span>
                </div>
            )}
        </button>
    );
}

export default function RegistroVisitantesSalida() {
    const [visitantes, setVisitantes] = useState<Visitante[]>([]);
    const [busqueda, setBusqueda] = useState("");
    const [periodoFecha, setPeriodoFecha] = useState<PeriodoFecha>(crearPeriodoActual);
    const [seleccionado, setSeleccionado] = useState<Visitante | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [openForm, setOpenForm] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [cargandoSalida, setCargandoSalida] = useState(false);
    const [firmaSalida, setFirmaSalida] = useState("");
    const [openFirmaSalida, setOpenFirmaSalida] = useState(false);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<MetaPaginacion | null>(null);
    const [pendientes, setPendientes] = useState<Visitante[]>([]);
    const [pendientesOpen, setPendientesOpen] = useState(false);
    const [loadingPendientes, setLoadingPendientes] = useState(true);
    const [errorPendientes, setErrorPendientes] = useState<string | null>(null);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);

        return () => clearInterval(timer);
    }, []);

    const cargarPendientes = useCallback(async () => {
        try {
            setLoadingPendientes(true);
            setErrorPendientes(null);

            const response = await listaVisitantesPendientes<Visitante>();
            setPendientes(response.data || []);
        } catch (error: any) {
            console.error(error);
            setPendientes([]);
            setErrorPendientes(
                error?.message || "No se pudieron consultar los visitantes pendientes.",
            );
        } finally {
            setLoadingPendientes(false);
        }
    }, []);

    useEffect(() => {
        cargarPendientes();
    }, [cargarPendientes]);

    const fetchActivos = async () => {
        try {
            setLoading(true);
            const response = await listaRegistroVisitantes<Visitante>({
                search: busqueda,
                fechaInicio: periodoFecha.fechaInicio,
                fechaFin: periodoFecha.fechaFin,
                page,
                per_page: REGISTROS_POR_PAGINA,
            });

            if (page > response.last_page) {
                setPage(response.last_page);
                return;
            }

            setVisitantes(response.data || []);
            setMeta({
                current_page: response.current_page,
                last_page: response.last_page,
                per_page: response.per_page,
                total: response.total,
                from: response.from,
                to: response.to,
            });
        } catch (error) {
            console.error(error);
            setVisitantes([]);
            setMeta(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchActivos();
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [busqueda, periodoFecha.periodo, periodoFecha.fechaInicio, periodoFecha.fechaFin, page]);

    const cerrarFormulario = async () => {
        setOpenForm(false);
        await Promise.all([fetchActivos(), cargarPendientes()]);
    };

    const limpiarFiltros = () => {
        setPage(1);
        setBusqueda("");
        setPeriodoFecha(crearPeriodoActual());
    };

    const abrirConfirmacionSalida = (visitante: Visitante) => {
        setFirmaSalida("");
        setOpenFirmaSalida(false);
        setSeleccionado(visitante);
    };

    const abrirPanelPendientes = async () => {
        setPendientesOpen(true);
        await cargarPendientes();
    };

    const registrarSalidaDesdePendientes = (visitante: Visitante) => {
        setPendientesOpen(false);
        abrirConfirmacionSalida(visitante);
    };

    const cerrarConfirmacionSalida = () => {
        if (cargandoSalida) return;

        setOpenFirmaSalida(false);
        setFirmaSalida("");
        setSeleccionado(null);
    };

    const handleFinalizarSalida = async () => {
        if (!seleccionado) return;

        if (!firmaSalida) {
            await Swal.fire({
                icon: "warning",
                title: "Firma requerida",
                text: "Solicite la firma del visitante antes de registrar la salida.",
                confirmButtonColor: "#4f46e5",
            });
            return;
        }

        setCargandoSalida(true);

        try {
            const datosSalida = {
                fechaSalida: currentTime.toLocaleDateString("en-CA"),
                horaSalida: currentTime.toLocaleTimeString("es-MX", {
                    hour12: false,
                }),
                firma_salida: firmaSalida,
            };

            await guardarSalida(seleccionado.id, datosSalida);

            const nombreVisitante = seleccionado.nombre;
            setOpenFirmaSalida(false);
            setFirmaSalida("");
            setSeleccionado(null);
            await Promise.all([fetchActivos(), cargarPendientes()]);

            await Swal.fire({
                title: "¡Salida registrada!",
                text: `La visita de ${nombreVisitante} finalizó correctamente.`,
                icon: "success",
                timer: 1800,
                showConfirmButton: false,
            });
        } catch (error: any) {
            await Swal.fire({
                title: "No se pudo registrar la salida",
                text: error?.message || "Ocurrió un error al procesar el registro.",
                icon: "error",
                confirmButtonColor: "#4f46e5",
            });
        } finally {
            setCargandoSalida(false);
        }
    };

    return (
        <>
            <div className="min-h-screen bg-[#f3f4f6] p-6">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <div>
                                <h2 className="text-xl font-black uppercase tracking-tighter text-slate-800">
                                    Registro de Visitantes
                                </h2>

                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Gestión de entradas y salidas de visitantes
                                </p>
                            </div>

                            {pendientes.length > 0 && (
                                <button
                                    type="button"
                                    onClick={abrirPanelPendientes}
                                    disabled={loadingPendientes}
                                    className="relative flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white shadow-md transition-all animate-pulse hover:bg-red-700 disabled:cursor-wait disabled:opacity-70"
                                    title="Ver visitantes pendientes de salida"
                                >
                                    <span className="relative flex h-3 w-3">
                                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                                        <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
                                    </span>

                                    <span className="text-sm font-bold">
                                        PENDIENTES ({pendientes.length})
                                    </span>
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setFiltersOpen(!filtersOpen)}
                                className={`flex items-center gap-2 rounded border px-4 py-2 text-[10px] font-black transition-all ${filtersOpen
                                    ? "border-slate-800 bg-slate-800 text-white"
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                    }`}
                            >
                                <Filter size={14} />
                                <span>{filtersOpen ? "OCULTAR FILTROS" : "FILTRAR"}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setOpenForm(true)}
                                className="flex items-center gap-2 rounded bg-indigo-600 px-4 py-2 text-[10px] font-black text-white shadow-md shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
                            >
                                <Plus size={14} />
                                NUEVO REGISTRO
                            </button>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full min-w-[1050px] border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-white">
                                        <th className="w-20 px-4 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            ID
                                        </th>
                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Visitante
                                        </th>
                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Procedencia
                                        </th>
                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Gafete
                                        </th>
                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Tipo de gafete
                                        </th>
                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Entrada
                                        </th>
                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Estado
                                        </th>
                                        <th className="px-6 py-4 text-right text-[9px] font-black uppercase text-slate-400">
                                            Acciones
                                        </th>
                                    </tr>

                                    <tr
                                        className={`bg-slate-50 transition-all duration-300 ease-in-out ${filtersOpen ? "opacity-100" : "hidden opacity-0"
                                            }`}
                                    >
                                        <td className="border-b border-slate-200 px-2 py-2">
                                            <div className="w-full rounded border border-slate-200 bg-white p-1.5 text-center text-[10px] font-bold uppercase text-slate-400">
                                                #
                                            </div>
                                        </td>

                                        <td className="border-b border-slate-200 px-2 py-2">
                                            <div className="relative">
                                                <Search
                                                    className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
                                                    size={13}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Nombre o gafete..."
                                                    value={busqueda}
                                                    onChange={(event) => {
                                                        setPage(1);
                                                        setBusqueda(event.target.value);
                                                    }}
                                                    className="w-full rounded border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-center text-[10px] uppercase outline-none focus:border-blue-400"
                                                />
                                            </div>
                                        </td>

                                        <td className="border-b border-slate-200 px-2 py-2">
                                            <div className="w-full rounded border border-slate-200 bg-white p-1.5 text-center text-[10px] font-bold uppercase text-slate-400">
                                                Todas
                                            </div>
                                        </td>

                                        <td className="border-b border-slate-200 px-2 py-2">
                                            <div className="w-full rounded border border-slate-200 bg-white p-1.5 text-center text-[10px] font-bold uppercase text-slate-400">
                                                Todos
                                            </div>
                                        </td>

                                        <td className="border-b border-slate-200 px-2 py-2">
                                            <div className="w-full rounded border border-slate-200 bg-white p-1.5 text-center text-[10px] font-bold uppercase text-slate-400">
                                                Rojo / Verde
                                            </div>
                                        </td>

                                        <td className="border-b border-slate-200 px-2 py-2">
                                            <FiltroPeriodoVisitantes
                                                value={periodoFecha}
                                                onChange={(value) => {
                                                    setPage(1);
                                                    setPeriodoFecha(value);
                                                }}
                                            />
                                        </td>

                                        <td className="border-b border-slate-200 px-2 py-2">
                                            <div className="w-full rounded border border-slate-200 bg-white p-1.5 text-center text-[10px] font-bold uppercase text-slate-400">
                                                Todos
                                            </div>
                                        </td>

                                        <td className="border-b border-slate-200 px-2 py-2 text-right">
                                            <button
                                                type="button"
                                                onClick={limpiarFiltros}
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
                                                colSpan={8}
                                                className="px-6 py-20 text-center text-[10px] font-black uppercase tracking-widest text-slate-400"
                                            >
                                                Cargando datos...
                                            </td>
                                        </tr>
                                    ) : visitantes.length > 0 ? (
                                        visitantes.map((visitante) => {
                                            const salio = Boolean(visitante.hora_salida);

                                            return (
                                                <tr
                                                    key={visitante.id}
                                                    className={`border-b border-slate-50 transition-colors ${salio ? "bg-emerald-50/20 hover:bg-emerald-50/50" : "bg-orange-50/30 hover:bg-orange-50/60"}`}
                                                >
                                                    <td className="px-4 py-4 text-center text-[10px] font-black text-slate-700">
                                                        #{visitante.id}
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-orange-100 bg-orange-50 text-orange-600">
                                                                <User size={13} />
                                                            </div>
                                                            <span className="text-[11px] font-bold uppercase tracking-tight text-slate-600">
                                                                {visitante.nombre || "—"}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black uppercase tracking-tight text-slate-600">
                                                            {visitante.procedencia || "—"}
                                                        </span>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                                                            <Hash size={12} />
                                                            {visitante.gafete || "—"}
                                                        </span>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <span
                                                            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-[10px] font-black uppercase tracking-tight ${clasesTipoGafete(visitante.tipo_gafete)}`}
                                                        >
                                                            <span
                                                                className={`h-2 w-2 rounded-full ${colorPuntoTipoGafete(visitante.tipo_gafete)}`}
                                                                aria-hidden="true"
                                                            />
                                                            {visitante.tipo_gafete || "Sin asignar"}
                                                        </span>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-800">
                                                            <Clock size={12} className="text-slate-400" />
                                                            {formatearHora(visitante.hora_entrada)}
                                                        </div>
                                                    </td>

                                                    <td className="px-6 py-4 text-center">
                                                        {salio ? (
                                                            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-tight text-emerald-700">
                                                                <CheckCircle2 size={12} />
                                                                Salió {visitante.hora_salida}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-tight text-orange-600">
                                                                <AlertCircle size={12} className="animate-pulse" />
                                                                En instalaciones
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end">
                                                            {!salio ? (
                                                                <button
                                                                    type="button"
                                                                    className="rounded p-2 text-slate-400 transition-colors hover:bg-orange-50 hover:text-orange-600"
                                                                    onClick={() => abrirConfirmacionSalida(visitante)}
                                                                    title="Registrar salida"
                                                                >
                                                                    <LogOut size={16} />
                                                                </button>
                                                            ) : (
                                                                <span className="px-2 text-slate-300">—</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan={8}
                                                className="px-6 py-20 text-center text-[10px] font-black uppercase tracking-widest text-slate-400"
                                            >
                                                No hay registros de visitantes
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {!loading && meta && meta.total > 0 && (
                        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                Mostrando {meta.from || 0} - {meta.to || 0} de {meta.total}{" "}
                                visitantes
                            </div>

                            <div className="flex flex-wrap items-center gap-1">
                                <button
                                    type="button"
                                    disabled={page <= 1 || loading}
                                    onClick={() => setPage((pagina) => pagina - 1)}
                                    className="flex items-center gap-1 rounded border border-slate-200 px-4 py-2 text-[10px] font-black transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <ChevronLeft size={14} />
                                    ANTERIOR
                                </button>

                                <span className="rounded border border-indigo-100 bg-indigo-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600">
                                    PÁGINA {meta.current_page} DE {meta.last_page}
                                </span>

                                <button
                                    type="button"
                                    disabled={page >= meta.last_page || loading}
                                    onClick={() => setPage((pagina) => pagina + 1)}
                                    className="flex items-center gap-1 rounded border border-slate-200 px-4 py-2 text-[10px] font-black transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    SIGUIENTE
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {pendientesOpen && (
                <div className="fixed inset-0 z-[105]">
                    <button
                        type="button"
                        aria-label="Cerrar visitantes pendientes"
                        onClick={() => setPendientesOpen(false)}
                        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-300"
                    />

                    <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-300">
                        <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-full bg-red-100 p-2 text-red-600">
                                    <BellRing size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-tight text-slate-800">
                                        Visitantes sin salida
                                    </h3>
                                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-red-600">
                                        {loadingPendientes
                                            ? "Consultando registros..."
                                            : `${pendientes.length} ${pendientes.length === 1 ? "registro pendiente" : "registros pendientes"}`}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setPendientesOpen(false)}
                                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                                title="Cerrar"
                            >
                                <X size={19} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 custom-scrollbar">
                            {loadingPendientes ? (
                                <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 text-slate-400">
                                    <BellRing size={28} className="animate-pulse text-red-400" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">
                                        Consultando pendientes...
                                    </p>
                                </div>
                            ) : errorPendientes ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center">
                                    <AlertCircle className="mx-auto text-amber-600" size={28} />
                                    <p className="mt-3 text-xs font-bold text-amber-800">
                                        {errorPendientes}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={cargarPendientes}
                                        className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-[10px] font-black uppercase text-white hover:bg-amber-700"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            ) : pendientes.length > 0 ? (
                                <div className="space-y-3">
                                    {pendientes.map((visitante) => (
                                        <article
                                            key={visitante.id}
                                            className="rounded-xl border border-red-100 bg-white p-4 shadow-sm"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-xs font-black uppercase text-slate-800">
                                                        {visitante.nombre}
                                                    </p>
                                                    <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                                        {visitante.procedencia || "Sin procedencia"}
                                                    </p>
                                                </div>
                                                <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[8px] font-black uppercase text-red-600">
                                                    Sin salida
                                                </span>
                                            </div>

                                            <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
                                                <div>
                                                    <p className="text-[8px] font-black uppercase text-slate-400">
                                                        Entrada
                                                    </p>
                                                    <p className="mt-1 text-[10px] font-bold text-slate-700">
                                                        {formatearFecha(visitante.fecha_entrada)} · {formatearHora(visitante.hora_entrada)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[8px] font-black uppercase text-slate-400">
                                                        Gafete
                                                    </p>
                                                    <p className="mt-1 text-[10px] font-bold uppercase text-slate-700">
                                                        {visitante.gafete || "—"} · {visitante.tipo_gafete || "Sin tipo"}
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => registrarSalidaDesdePendientes(visitante)}
                                                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-orange-700"
                                            >
                                                <LogOut size={14} />
                                                Registrar salida
                                            </button>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/60 p-6 text-center">
                                    <CheckCircle2 size={32} className="text-emerald-500" />
                                    <div>
                                        <p className="text-xs font-black uppercase text-emerald-700">
                                            Sin visitantes pendientes
                                        </p>
                                        <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-emerald-600/70">
                                            Todos los registros tienen salida
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            )}

            {openForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="relative z-10 flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between border-b border-blue-800 bg-blue-900 px-6 py-5 text-white">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight">
                                    Registrar entrada de visitante
                                </h3>
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-blue-200">
                                    Módulo de registro de visitantes
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setOpenForm(false)}
                                className="rounded-full p-2 text-blue-200 transition-colors hover:bg-blue-800 hover:text-white"
                                title="Cerrar"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="overflow-y-auto bg-[#f8fafc] custom-scrollbar">
                            <RegistroVisitantesForm onSuccess={cerrarFormulario} />
                        </div>
                    </div>
                </div>
            )}

            {seleccionado && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-lg overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between border-b border-blue-800 bg-blue-900 px-6 py-5 text-white">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight">
                                    Confirmar salida
                                </h3>
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-blue-200">
                                    Finalizar visita
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={cerrarConfirmacionSalida}
                                disabled={cargandoSalida}
                                className="rounded-full p-2 text-blue-200 transition-colors hover:bg-blue-800 hover:text-white disabled:opacity-50"
                                title="Cerrar"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-5 bg-[#f8fafc] p-6">
                            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-orange-100 bg-orange-50 text-orange-600">
                                    <User size={18} />
                                </div>
                                <div>
                                    <p className="text-[11px] font-black uppercase text-slate-800">
                                        {seleccionado.nombre}
                                    </p>
                                    <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                        Gafete {seleccionado.gafete} · Tipo{" "}
                                        {seleccionado.tipo_gafete || "Sin asignar"} · Entrada{" "}
                                        {formatearHora(seleccionado.hora_entrada)}
                                    </p>
                                </div>
                            </div>

                            <FirmaSalidaBox
                                value={firmaSalida}
                                disabled={cargandoSalida}
                                onClick={() => setOpenFirmaSalida(true)}
                            />

                            <button
                                type="button"
                                onClick={handleFinalizarSalida}
                                disabled={cargandoSalida}
                                className={`flex w-full items-center justify-center gap-2 rounded px-4 py-3 text-[10px] font-black text-white shadow-md transition-all active:scale-[0.99] ${cargandoSalida
                                    ? "cursor-not-allowed bg-slate-400"
                                    : "bg-orange-600 hover:bg-orange-700"
                                    }`}
                            >
                                <LogOut size={15} />
                                {cargandoSalida
                                    ? "PROCESANDO SALIDA..."
                                    : "FINALIZAR VISITA Y REGISTRAR SALIDA"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <FirmaCanvas
                open={openFirmaSalida && seleccionado !== null}
                title="Firma de salida del visitante"
                value={firmaSalida}
                onClose={() => setOpenFirmaSalida(false)}
                onChange={(base64: string) => setFirmaSalida(base64)}
            />
        </>
    );
}
