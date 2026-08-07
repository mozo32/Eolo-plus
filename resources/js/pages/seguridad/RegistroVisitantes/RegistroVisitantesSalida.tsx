import React, { useEffect, useState } from "react";
import {AlertCircle, Calendar, ChevronLeft, ChevronRight, Clock, Filter, Hash, LogOut, PenTool, Plus, Search, User, X, } from "lucide-react";
import Swal from "sweetalert2";
import RegistroVisitantesForm from "./RegistroVisitantesFrom";
import {
    guardarSalida,
    listaRegistroVisitantes,
    type MetaPaginacion,
} from "@/stores/apiRegistroVisitantes";
import FirmaCanvas from "@/pages/FirmaCanvas";

interface Visitante {
    id: number;
    nombre: string;
    procedencia: string;
    hora_entrada: string;
    gafete: string;
    tipo_gafete?: "Rojo" | "Verde" | null;
}

const obtenerFechaActual = () => new Date().toLocaleDateString("en-CA");
const REGISTROS_POR_PAGINA = 10;

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
    const [fecha, setFecha] = useState(obtenerFechaActual());
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

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);

        return () => clearInterval(timer);
    }, []);

    const fetchActivos = async () => {
        try {
            setLoading(true);
            const response = await listaRegistroVisitantes<Visitante>({
                search: busqueda,
                fecha,
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
    }, [busqueda, fecha, page]);

    const cerrarFormulario = async () => {
        setOpenForm(false);
        await fetchActivos();
    };

    const limpiarFiltros = () => {
        setPage(1);
        setBusqueda("");
        setFecha(obtenerFechaActual());
    };

    const abrirConfirmacionSalida = (visitante: Visitante) => {
        setFirmaSalida("");
        setOpenFirmaSalida(false);
        setSeleccionado(visitante);
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
            await fetchActivos();

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
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tighter text-slate-800">
                                Registro de Visitantes
                            </h2>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Gestión de entradas y salidas de visitantes
                            </p>
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
                                            <div className="relative">
                                                <Calendar
                                                    className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
                                                    size={13}
                                                />
                                                <input
                                                    type="date"
                                                    value={fecha}
                                                    onChange={(event) => {
                                                        setPage(1);
                                                        setFecha(event.target.value);
                                                    }}
                                                    className="w-full rounded border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-center text-[10px] font-bold text-slate-600 outline-none focus:border-blue-400"
                                                />
                                            </div>
                                        </td>

                                        <td className="border-b border-slate-200 px-2 py-2">
                                            <div className="w-full rounded border border-slate-200 bg-white p-1.5 text-center text-[10px] font-bold uppercase text-slate-400">
                                                En instalaciones
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
                                        visitantes.map((visitante) => (
                                            <tr
                                                key={visitante.id}
                                                className="border-b border-slate-50 bg-orange-50/30 transition-colors hover:bg-orange-50/60"
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
                                                        {visitante.hora_entrada || "—"}
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-tight text-orange-600">
                                                        <AlertCircle size={12} className="animate-pulse" />
                                                        En instalaciones
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end">
                                                        <button
                                                            type="button"
                                                            className="rounded p-2 text-slate-400 transition-colors hover:bg-orange-50 hover:text-orange-600"
                                                            onClick={() => abrirConfirmacionSalida(visitante)}
                                                            title="Registrar salida"
                                                        >
                                                            <LogOut size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan={8}
                                                className="px-6 py-20 text-center text-[10px] font-black uppercase tracking-widest text-slate-400"
                                            >
                                                No hay visitantes pendientes de salida
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
                                        {seleccionado.hora_entrada}
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
