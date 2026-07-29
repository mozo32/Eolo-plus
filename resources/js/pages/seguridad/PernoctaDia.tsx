import AppLayout from "@/layouts/app-layout";
import { Head } from "@inertiajs/react";
;
import { Fragment, useCallback, useEffect, useState } from "react";
import ModalVistaPreviaExcelPernocta from "./pernoctaDia/ModalVistaPreviaExcelPernocta";
import {
    obtenerPernoctasExcelApi,
    type PernoctaExcelRegistro,
} from "@/stores/apiPernoctaMes";

import { type BreadcrumbItem } from "@/types";
import PernoctaDiaForm, {
    PernoctaDiaItem,
} from "./pernoctaDia/PernoctaDiaForm";
import PernoctaDiaTable from "./pernoctaDia/PernoctaDiaTable";
import { ExcelPernoctaDia } from "./pernoctaDia/ExcelPernoctaDia";
import {
    guardarPernoctaDiaApi,
    obtenerPernoctasApi,
    type PernoctaPaginationMeta,
    type PernoctaRegistro,
} from "@/stores/apiPernoctaDia";
import Swal from "sweetalert2";
import {
    Calendar,
    ChevronDown,
    Download,
    Filter,
    LoaderCircle,
    MapPin,
    Plane,
    Plus,
    Save,
    X,
} from "lucide-react";

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: "Pernocta del Día",
    },
];

type PeriodoPernocta = "dia" | "rango" | "mes" | "año";

type FiltrosPernocta = {
    matricula: string;
    ubicacion: string;
    responsable: string;
    fechaInicio: string;
    fechaFin: string;
    periodo: PeriodoPernocta;
};

const obtenerFechaActual = () => {
    return new Date().toLocaleDateString("en-CA");
};

const formatearFecha = (fecha: string) => {
    if (!fecha) return "";

    const fechaSinHora = fecha.substring(0, 10);
    const [year, month, day] = fechaSinHora.split("-");

    if (!year || !month || !day) return fecha;

    return `${day}/${month}/${year}`;
};

const formatearHora = (hora: string) => {
    if (!hora) return "";

    return hora.substring(0, 5);
};

const obtenerUltimoDiaMes = (
    year: number,
    month: number,
) => {
    return new Date(year, month, 0).getDate();
};

export default function PernoctaDia() {
    const [mostrarVistaPreviaExcel, setMostrarVistaPreviaExcel] = useState(false);
    const [cargandoVistaPreviaExcel, setCargandoVistaPreviaExcel] = useState(false);
    const [descargandoExcel, setDescargandoExcel] = useState(false);
    const [registrosExcel, setRegistrosExcel] = useState<PernoctaExcelRegistro[]>([]);
    const [periodoExcel, setPeriodoExcel] = useState("");
    const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({});
    const fechaActual = obtenerFechaActual();
    const anioActual = new Date().getFullYear().toString();

    const [items, setItems] = useState<PernoctaDiaItem[]>([]);
    const [registros, setRegistros] = useState<PernoctaRegistro[]>([]);

    const [showForm, setShowForm] = useState(false);
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    const [mostrarModalFecha, setMostrarModalFecha] =
        useState(false);

    const [guardando, setGuardando] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [pagina, setPagina] = useState(1);

    const [anioEdicion, setAnioEdicion] =
        useState(anioActual);
    const alternarGrupo = (grupoId: string) => {
        setGruposAbiertos((prev) => ({
            ...prev,
            [grupoId]: !prev[grupoId],
        }));
    };
    const [meta, setMeta] = useState<PernoctaPaginationMeta>({
        current_page: 1,
        last_page: 1,
        per_page: 20,
        total: 0,
        from: null,
        to: null,
    });

    const [filtros, setFiltros] =
        useState<FiltrosPernocta>({
            matricula: "",
            ubicacion: "",
            responsable: "",
            fechaInicio: fechaActual,
            fechaFin: fechaActual,
            periodo: "dia",
        });

    const [filtrosEdicion, setFiltrosEdicion] =
        useState<FiltrosPernocta>({
            matricula: "",
            ubicacion: "",
            responsable: "",
            fechaInicio: fechaActual,
            fechaFin: fechaActual,
            periodo: "dia",
        });

    const cargarRegistros = useCallback(
        async (
            page: number = 1,
            signal?: AbortSignal,
        ) => {
            setCargando(true);

            try {
                const response = await obtenerPernoctasApi(
                    {
                        matricula: filtros.matricula.trim(),
                        ubicacion: filtros.ubicacion,
                        responsable: filtros.responsable.trim(),
                        fechaInicio: filtros.fechaInicio,
                        fechaFin: filtros.fechaFin,
                        periodo: filtros.periodo,
                        page,
                        per_page: 20,
                    },
                    signal,
                );

                if (signal?.aborted) return;

                setRegistros(response.data || []);
                setMeta(response.meta);
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.name === "AbortError"
                ) {
                    return;
                }

                Swal.fire({
                    icon: "error",
                    title: "Error",
                    text:
                        error instanceof Error
                            ? error.message
                            : "No se pudieron cargar las pernoctas",
                    confirmButtonColor: "#4f46e5",
                });
            } finally {
                if (!signal?.aborted) {
                    setCargando(false);
                }
            }
        },
        [filtros],
    );

    useEffect(() => {
        const controller = new AbortController();

        const timeout = window.setTimeout(() => {
            cargarRegistros(
                pagina,
                controller.signal,
            );
        }, 400);

        return () => {
            window.clearTimeout(timeout);
            controller.abort();
        };
    }, [pagina, cargarRegistros]);

    useEffect(() => {
        if (!mostrarModalFecha) return;

        setFiltrosEdicion({
            ...filtros,
        });

        setAnioEdicion(
            filtros.fechaInicio
                ? filtros.fechaInicio.substring(0, 4)
                : anioActual,
        );
    }, [mostrarModalFecha, filtros, anioActual]);

    const actualizarFiltro = (
        campo: keyof FiltrosPernocta,
        valor: string,
    ) => {
        setFiltros((prev) => ({
            ...prev,
            [campo]: valor,
        }));

        setPagina(1);
    };

    const limpiarFiltros = () => {
        const filtrosLimpios: FiltrosPernocta = {
            matricula: "",
            ubicacion: "",
            responsable: "",
            fechaInicio: fechaActual,
            fechaFin: fechaActual,
            periodo: "dia",
        };

        setFiltros(filtrosLimpios);
        setFiltrosEdicion(filtrosLimpios);
        setAnioEdicion(anioActual);
        setPagina(1);
    };

    const aplicarFiltroFecha = () => {
        let filtrosAplicar: FiltrosPernocta = {
            ...filtrosEdicion,
        };
        if (filtrosAplicar.periodo === "mes") {
            const rangoMes = obtenerRangoMes(
                filtrosAplicar.fechaInicio,
            );

            filtrosAplicar = {
                ...filtrosAplicar,
                ...rangoMes,
            };
        }
        if (filtrosEdicion.periodo === "año") {
            if (!/^\d{4}$/.test(anioEdicion)) {
                Swal.fire({
                    icon: "warning",
                    title: "Año incorrecto",
                    text: "Ingresa un año de cuatro dígitos.",
                    confirmButtonColor: "#4f46e5",
                });

                return;
            }

            const yearNumero = Number(anioEdicion);

            if (
                yearNumero < 1900 ||
                yearNumero > 2100
            ) {
                Swal.fire({
                    icon: "warning",
                    title: "Año incorrecto",
                    text: "El año debe estar entre 1900 y 2100.",
                    confirmButtonColor: "#4f46e5",
                });

                return;
            }

            filtrosAplicar = {
                ...filtrosAplicar,
                fechaInicio: `${anioEdicion}-01-01`,
                fechaFin: `${anioEdicion}-12-31`,
            };
        }

        if (
            !filtrosAplicar.fechaInicio ||
            !filtrosAplicar.fechaFin
        ) {
            Swal.fire({
                icon: "warning",
                title: "Fecha requerida",
                text: "Selecciona una fecha válida.",
                confirmButtonColor: "#4f46e5",
            });

            return;
        }

        if (
            filtrosAplicar.fechaInicio >
            filtrosAplicar.fechaFin
        ) {
            Swal.fire({
                icon: "warning",
                title: "Rango incorrecto",
                text: "La fecha inicial no puede ser mayor que la fecha final.",
                confirmButtonColor: "#4f46e5",
            });

            return;
        }

        setFiltros(filtrosAplicar);
        setFiltrosEdicion(filtrosAplicar);
        setPagina(1);
        setMostrarModalFecha(false);
    };
    const obtenerRangoMes = (fechaBase?: string) => {
        const valorMes = (
            fechaBase || fechaActual
        ).substring(0, 7);

        const [year, month] = valorMes.split("-");

        const ultimoDia = obtenerUltimoDiaMes(
            Number(year),
            Number(month),
        );

        return {
            fechaInicio: `${year}-${month}-01`,
            fechaFin: `${year}-${month}-${String(
                ultimoDia,
            ).padStart(2, "0")}`,
        };
    };
    const cambiarPeriodo = (
        periodo: PeriodoPernocta,
    ) => {
        const nuevosFiltros: FiltrosPernocta = {
            ...filtrosEdicion,
            periodo,
        };

        if (periodo === "dia") {
            const fechaSeleccionada =
                nuevosFiltros.fechaInicio || fechaActual;

            nuevosFiltros.fechaInicio =
                fechaSeleccionada;

            nuevosFiltros.fechaFin =
                fechaSeleccionada;
        }

        if (periodo === "mes") {
            const rangoMes = obtenerRangoMes(
                nuevosFiltros.fechaInicio,
            );

            nuevosFiltros.fechaInicio =
                rangoMes.fechaInicio;

            nuevosFiltros.fechaFin =
                rangoMes.fechaFin;
        }

        if (periodo === "año") {
            const year =
                nuevosFiltros.fechaInicio?.substring(
                    0,
                    4,
                ) || anioActual;

            setAnioEdicion(year);

            nuevosFiltros.fechaInicio =
                `${year}-01-01`;

            nuevosFiltros.fechaFin =
                `${year}-12-31`;
        }

        setFiltrosEdicion(nuevosFiltros);
    };

    const seleccionarDia = (fecha: string) => {
        setFiltrosEdicion((prev) => ({
            ...prev,
            fechaInicio: fecha,
            fechaFin: fecha,
        }));
    };

    const seleccionarMes = (valor: string) => {
        if (!valor) {
            setFiltrosEdicion((prev) => ({
                ...prev,
                fechaInicio: "",
                fechaFin: "",
            }));

            return;
        }

        const [year, month] = valor.split("-");

        const ultimoDia = obtenerUltimoDiaMes(
            Number(year),
            Number(month),
        );

        setFiltrosEdicion((prev) => ({
            ...prev,
            fechaInicio: `${year}-${month}-01`,
            fechaFin: `${year}-${month}-${String(
                ultimoDia,
            ).padStart(2, "0")}`,
        }));
    };

    const seleccionarAnio = (valor: string) => {
        const yearLimpio = valor
            .replace(/\D/g, "")
            .substring(0, 4);

        setAnioEdicion(yearLimpio);

        if (!yearLimpio) {
            setFiltrosEdicion((prev) => ({
                ...prev,
                fechaInicio: "",
                fechaFin: "",
            }));

            return;
        }

        if (yearLimpio.length === 4) {
            setFiltrosEdicion((prev) => ({
                ...prev,
                fechaInicio: `${yearLimpio}-01-01`,
                fechaFin: `${yearLimpio}-12-31`,
            }));
        }
    };

    const obtenerValorMes = () => {
        if (!filtrosEdicion.fechaInicio) {
            return "";
        }

        return filtrosEdicion.fechaInicio.substring(
            0,
            7,
        );
    };

    const obtenerTextoPeriodo = () => {
        if (filtros.periodo === "dia") {
            return formatearFecha(
                filtros.fechaInicio,
            );
        }

        if (filtros.periodo === "rango") {
            return `${formatearFecha(
                filtros.fechaInicio,
            )} / ${formatearFecha(
                filtros.fechaFin,
            )}`;
        }

        if (filtros.periodo === "mes") {
            if (!filtros.fechaInicio) {
                return "MES";
            }

            const fecha = new Date(
                `${filtros.fechaInicio}T00:00:00`,
            );

            return fecha.toLocaleDateString("es-MX", {
                month: "long",
                year: "numeric",
            });
        }

        if (filtros.periodo === "año") {
            return filtros.fechaInicio
                ? filtros.fechaInicio.substring(0, 4)
                : "AÑO";
        }

        return "SELECCIONAR";
    };

    const handleAdd = (
        item: PernoctaDiaItem,
    ) => {
        const existe = items.some(
            (registro) =>
                registro.matricula.toUpperCase() ===
                item.matricula.toUpperCase(),
        );

        if (existe) {
            Swal.fire({
                icon: "warning",
                title: "Matrícula duplicada",
                text: "Esta matrícula ya fue agregada a la lista.",
                confirmButtonColor: "#4f46e5",
            });

            return;
        }

        setItems((prev) => [...prev, item]);
    };

    const handleRemove = (index: number) => {
        setItems((prev) =>
            prev.filter(
                (_, itemIndex) =>
                    itemIndex !== index,
            ),
        );
    };

    const abrirModal = () => {
        setShowForm(true);
    };

    const cerrarModal = () => {
        if (guardando) return;

        setShowForm(false);
        setItems([]);
    };

    const handleGuardar = async () => {
        if (!items.length || guardando) return;

        const horaActual =
            new Date().toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
            });

        const itemsForms = items.map((item) => ({
            ...item,
            hora: horaActual,
        }));

        try {
            setGuardando(true);

            const response =
                await guardarPernoctaDiaApi(
                    itemsForms,
                );

            setItems([]);
            setShowForm(false);
            setPagina(1);

            await cargarRegistros(1);

            await Swal.fire({
                icon: "success",
                title: "Proceso exitoso",
                text:
                    response?.message ||
                    "Pernoctas guardadas correctamente",
                confirmButtonColor: "#4f46e5",
            });
        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text:
                    error instanceof Error
                        ? error.message
                        : "No se pudo guardar la información",
                confirmButtonColor: "#4f46e5",
            });
        } finally {
            setGuardando(false);
        }
    };
    const abrirVistaPreviaExcel = async () => {
        if (cargandoVistaPreviaExcel) return;

        setMostrarVistaPreviaExcel(true);
        setCargandoVistaPreviaExcel(true);
        setRegistrosExcel([]);
        setPeriodoExcel(obtenerTextoPeriodo());

        try {
            const response =
                await obtenerPernoctasExcelApi({
                    desde: filtros.fechaInicio,
                    hasta: filtros.fechaFin,
                    matricula:
                        filtros.matricula.trim(),
                    ubicacion: filtros.ubicacion,
                    responsable:
                        filtros.responsable.trim(),
                });

            if (!response.data.length) {
                setMostrarVistaPreviaExcel(false);

                await Swal.fire({
                    icon: "warning",
                    title: "Sin registros",
                    text: "No hay información para exportar con los filtros seleccionados.",
                    confirmButtonColor: "#4f46e5",
                });

                return;
            }

            setRegistrosExcel(response.data);
        } catch (error) {
            setMostrarVistaPreviaExcel(false);

            await Swal.fire({
                icon: "error",
                title: "Error",
                text:
                    error instanceof Error
                        ? error.message
                        : "No se pudo preparar la vista previa del Excel.",
                confirmButtonColor: "#ef4444",
            });
        } finally {
            setCargandoVistaPreviaExcel(false);
        }
    };

    const confirmarDescargaExcel = async () => {
        if (
            descargandoExcel ||
            !registrosExcel.length
        ) {
            return;
        }

        try {
            setDescargandoExcel(true);

            await ExcelPernoctaDia(
                registrosExcel,
                periodoExcel,
            );

            setMostrarVistaPreviaExcel(false);
            setRegistrosExcel([]);

            await Swal.fire({
                icon: "success",
                title: "Excel generado",
                text: "El reporte se descargó correctamente.",
                timer: 1800,
                showConfirmButton: false,
            });
        } catch (error) {
            await Swal.fire({
                icon: "error",
                title: "Error",
                text:
                    error instanceof Error
                        ? error.message
                        : "No se pudo generar el archivo Excel.",
                confirmButtonColor: "#ef4444",
            });
        } finally {
            setDescargandoExcel(false);
        }
    };
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Pernocta del Día" />

            <div className="relative min-h-screen bg-[#f3f4f6] p-4 sm:p-6">
                <div className="space-y-4 animate-in fade-in duration-500">
                    <div className="flex flex-col justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tighter text-slate-800">
                                Pernoctas del Día
                            </h2>

                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Control y registro de aeronaves
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={abrirVistaPreviaExcel}
                                disabled={cargandoVistaPreviaExcel}
                                className="flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase text-slate-600 shadow-sm transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                            >
                                {cargandoVistaPreviaExcel ? (
                                    <LoaderCircle
                                        size={14}
                                        className="animate-spin text-emerald-600"
                                    />
                                ) : (
                                    <Download
                                        size={14}
                                        className="text-emerald-600"
                                    />
                                )}

                                <span className="hidden sm:inline">
                                    Exportar Excel
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setMostrarFiltros((prev) => !prev)
                                }
                                className={`flex items-center gap-2 rounded border px-4 py-2 text-[10px] font-black transition-all ${mostrarFiltros
                                    ? "border-slate-800 bg-slate-800 text-white"
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                    }`}
                            >
                                <Filter size={14} />

                                <span>
                                    {mostrarFiltros
                                        ? "OCULTAR FILTROS"
                                        : "FILTRAR"}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={abrirModal}
                                className="rounded bg-indigo-600 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-md transition-all hover:bg-indigo-700 active:scale-95"
                            >
                                <span className="flex items-center gap-2">
                                    <Plus size={14} />
                                    NUEVA PERNOCTA
                                </span>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1000px] border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-white">
                                        <th className="w-12 px-4 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            #
                                        </th>

                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Fecha / Hora
                                        </th>

                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Matrícula / Aeronave
                                        </th>

                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Ubicación
                                        </th>

                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Observaciones
                                        </th>

                                        <th className="px-6 py-4 text-center text-[9px] font-black uppercase text-slate-400">
                                            Responsable
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    <tr
                                        className={`overflow-hidden border-b border-slate-200 bg-slate-50 transition-all duration-300 ${mostrarFiltros
                                            ? "opacity-100"
                                            : "hidden"
                                            }`}
                                    >
                                        <td className="px-2 py-2 text-center">
                                            <button
                                                type="button"
                                                onClick={
                                                    limpiarFiltros
                                                }
                                                className="text-slate-400 transition-colors hover:text-red-500"
                                                title="Limpiar filtros"
                                            >
                                                <X size={14} />
                                            </button>
                                        </td>

                                        <td className="px-2 py-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setMostrarModalFecha(
                                                        true,
                                                    )
                                                }
                                                className="flex w-full items-center justify-between rounded border border-slate-200 bg-white p-1.5 text-[10px] shadow-sm transition-colors hover:border-blue-400"
                                            >
                                                <div className="flex min-w-0 items-center gap-1">
                                                    <Calendar
                                                        size={12}
                                                        className="shrink-0 text-blue-500"
                                                    />

                                                    <span className="truncate font-bold uppercase text-slate-600">
                                                        {obtenerTextoPeriodo()}
                                                    </span>
                                                </div>

                                                <ChevronDown
                                                    size={12}
                                                    className="shrink-0 text-slate-400"
                                                />
                                            </button>
                                        </td>

                                        <td className="px-2 py-2">
                                            <input
                                                type="text"
                                                value={
                                                    filtros.matricula
                                                }
                                                onChange={(
                                                    event,
                                                ) =>
                                                    actualizarFiltro(
                                                        "matricula",
                                                        event.target.value.toUpperCase(),
                                                    )
                                                }
                                                placeholder="Matrícula..."
                                                className="w-full rounded border border-slate-200 bg-white p-1 text-center text-[10px] uppercase outline-none focus:border-blue-400"
                                            />
                                        </td>

                                        <td className="px-2 py-2">
                                            <select
                                                value={
                                                    filtros.ubicacion
                                                }
                                                onChange={(
                                                    event,
                                                ) =>
                                                    actualizarFiltro(
                                                        "ubicacion",
                                                        event.target.value,
                                                    )
                                                }
                                                className="w-full rounded border border-slate-200 bg-white p-1 text-center text-[10px] font-bold uppercase text-slate-600 outline-none focus:border-blue-400"
                                            >
                                                <option value="">
                                                    Todas
                                                </option>

                                                <option value="H1">
                                                    Hangar 1
                                                </option>

                                                <option value="H2">
                                                    Hangar 2
                                                </option>
                                            </select>
                                        </td>

                                        <td className="px-2 py-2">
                                            <div className="w-full rounded border border-slate-200 bg-white p-1 text-center text-[10px] uppercase text-slate-400">
                                                Observaciones
                                            </div>
                                        </td>

                                        <td className="px-2 py-2">
                                            <input
                                                type="text"
                                                value={
                                                    filtros.responsable
                                                }
                                                onChange={(
                                                    event,
                                                ) =>
                                                    actualizarFiltro(
                                                        "responsable",
                                                        event.target.value,
                                                    )
                                                }
                                                placeholder="Responsable..."
                                                className="w-full rounded border border-slate-200 bg-white p-1 text-center text-[10px] outline-none focus:border-blue-400"
                                            />
                                        </td>
                                    </tr>

                                    {cargando ? (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-6 py-20 text-center"
                                            >
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <LoaderCircle
                                                        size={24}
                                                        className="animate-spin text-indigo-500"
                                                    />

                                                    <span className="text-[10px] font-black uppercase text-slate-400">
                                                        Cargando datos...
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : registros.length > 0 ? (
                                        registros.map((grupo, index) => {
                                            const numeroFila =
                                                (meta.current_page - 1) *
                                                meta.per_page +
                                                index +
                                                1;

                                            const estaAbierto =
                                                Boolean(gruposAbiertos[grupo.id]);

                                            const ubicaciones = Array.from(
                                                new Set(
                                                    grupo.registros
                                                        .map((registro) => registro.ubicacion)
                                                        .filter(Boolean),
                                                ),
                                            );

                                            const responsables = Array.from(
                                                new Set(
                                                    grupo.registros
                                                        .map((registro) => registro.nombre)
                                                        .filter(Boolean),
                                                ),
                                            );

                                            return (
                                                <Fragment key={grupo.id}>
                                                    {/* Fila principal del grupo */}
                                                    <tr
                                                        onClick={() =>
                                                            alternarGrupo(grupo.id)
                                                        }
                                                        className={`cursor-pointer border-b border-l-4 transition-colors ${estaAbierto
                                                            ? "border-b-indigo-100 border-l-indigo-500 bg-indigo-50/40"
                                                            : "border-b-slate-50 border-l-transparent hover:bg-slate-50/80"
                                                            }`}
                                                    >
                                                        <td className="px-4 py-4 text-center text-[10px] font-bold text-slate-400">
                                                            {numeroFila}
                                                        </td>

                                                        <td className="px-6 py-4 text-center">
                                                            <span className="block text-[10px] font-bold text-slate-400">
                                                                {formatearFecha(
                                                                    grupo.fecha,
                                                                )}
                                                            </span>

                                                            <span className="text-sm font-black text-slate-700">
                                                                {formatearHora(
                                                                    grupo.hora,
                                                                )}
                                                            </span>
                                                        </td>

                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-indigo-600 px-2 py-1 text-[10px] font-black text-white">
                                                                    {grupo.total}
                                                                </span>

                                                                <span className="mt-1 text-[8px] font-bold uppercase tracking-widest text-slate-400">
                                                                    {grupo.total === 1
                                                                        ? "Aeronave"
                                                                        : "Aeronaves"}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex flex-wrap justify-center gap-1">
                                                                {ubicaciones.map(
                                                                    (ubicacion) => (
                                                                        <span
                                                                            key={ubicacion}
                                                                            className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[9px] font-black uppercase text-indigo-600"
                                                                        >
                                                                            <MapPin size={10} />

                                                                            {ubicacion === "H1"
                                                                                ? "Hangar 1"
                                                                                : ubicacion === "H2"
                                                                                    ? "Hangar 2"
                                                                                    : ubicacion}
                                                                        </span>
                                                                    ),
                                                                )}
                                                            </div>
                                                        </td>

                                                        <td className="px-6 py-4 text-center">
                                                            <span className="text-[10px] font-bold text-slate-500">
                                                                Haz clic para ver las matrículas
                                                            </span>
                                                        </td>

                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex items-center justify-center gap-3">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">
                                                                        Responsables
                                                                    </span>

                                                                    <span className="text-[10px] font-black text-slate-700">
                                                                        {responsables.length}
                                                                    </span>
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    onClick={(event) => {
                                                                        event.stopPropagation();
                                                                        alternarGrupo(
                                                                            grupo.id,
                                                                        );
                                                                    }}
                                                                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-indigo-100 hover:text-indigo-600"
                                                                    title={
                                                                        estaAbierto
                                                                            ? "Ocultar aeronaves"
                                                                            : "Mostrar aeronaves"
                                                                    }
                                                                >
                                                                    <ChevronDown
                                                                        size={17}
                                                                        className={`transition-transform duration-300 ${estaAbierto
                                                                            ? "rotate-180"
                                                                            : ""
                                                                            }`}
                                                                    />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* Información desplegable */}
                                                    {estaAbierto && (
                                                        <tr className="border-b border-indigo-100 bg-slate-50">
                                                            <td
                                                                colSpan={6}
                                                                className="px-4 py-4 sm:px-8"
                                                            >
                                                                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm animate-in slide-in-from-top-2 duration-200">
                                                                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                                                                        <div>
                                                                            <h4 className="text-xs font-black uppercase text-slate-700">
                                                                                Aeronaves registradas
                                                                            </h4>

                                                                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                                                                {formatearFecha(
                                                                                    grupo.fecha,
                                                                                )}{" "}
                                                                                a las{" "}
                                                                                {formatearHora(
                                                                                    grupo.hora,
                                                                                )}
                                                                            </p>
                                                                        </div>

                                                                        <span className="rounded-lg bg-indigo-600 px-3 py-1 text-[10px] font-black text-white">
                                                                            {grupo.total}
                                                                        </span>
                                                                    </div>

                                                                    <div className="overflow-x-auto">
                                                                        <table className="w-full min-w-[850px]">
                                                                            <thead>
                                                                                <tr className="border-b border-slate-100 bg-white">
                                                                                    <th className="px-4 py-3 text-center text-[9px] font-black uppercase text-slate-400">
                                                                                        #
                                                                                    </th>

                                                                                    <th className="px-4 py-3 text-center text-[9px] font-black uppercase text-slate-400">
                                                                                        Matrícula
                                                                                    </th>

                                                                                    <th className="px-4 py-3 text-center text-[9px] font-black uppercase text-slate-400">
                                                                                        Aeronave
                                                                                    </th>

                                                                                    <th className="px-4 py-3 text-center text-[9px] font-black uppercase text-slate-400">
                                                                                        Ubicación
                                                                                    </th>

                                                                                    <th className="px-4 py-3 text-center text-[9px] font-black uppercase text-slate-400">
                                                                                        Observaciones
                                                                                    </th>

                                                                                    <th className="px-4 py-3 text-center text-[9px] font-black uppercase text-slate-400">
                                                                                        Responsable
                                                                                    </th>
                                                                                </tr>
                                                                            </thead>

                                                                            <tbody>
                                                                                {grupo.registros.map(
                                                                                    (
                                                                                        detalle,
                                                                                        detalleIndex,
                                                                                    ) => (
                                                                                        <tr
                                                                                            key={
                                                                                                detalle.id
                                                                                            }
                                                                                            className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50"
                                                                                        >
                                                                                            <td className="px-4 py-3 text-center text-[10px] font-bold text-slate-400">
                                                                                                {detalleIndex +
                                                                                                    1}
                                                                                            </td>

                                                                                            <td className="px-4 py-3 text-center">
                                                                                                <span className="text-sm font-black uppercase text-slate-800">
                                                                                                    {
                                                                                                        detalle.matricula
                                                                                                    }
                                                                                                </span>
                                                                                            </td>

                                                                                            <td className="px-4 py-3 text-center">
                                                                                                <span className="text-[10px] font-bold uppercase text-slate-600">
                                                                                                    {detalle.aeronave ||
                                                                                                        "Sin tipo registrado"}
                                                                                                </span>
                                                                                            </td>

                                                                                            <td className="px-4 py-3 text-center">
                                                                                                <span className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[9px] font-black uppercase text-indigo-600">
                                                                                                    <MapPin
                                                                                                        size={
                                                                                                            10
                                                                                                        }
                                                                                                    />

                                                                                                    {detalle.ubicacion ===
                                                                                                        "H1"
                                                                                                        ? "Hangar 1"
                                                                                                        : detalle.ubicacion ===
                                                                                                            "H2"
                                                                                                            ? "Hangar 2"
                                                                                                            : detalle.ubicacion}
                                                                                                </span>
                                                                                            </td>

                                                                                            <td className="max-w-xs px-4 py-3 text-center">
                                                                                                <span
                                                                                                    className="line-clamp-2 text-[10px] font-bold text-slate-600"
                                                                                                    title={
                                                                                                        detalle.observaciones ||
                                                                                                        "Sin observaciones"
                                                                                                    }
                                                                                                >
                                                                                                    {detalle.observaciones ||
                                                                                                        "Sin observaciones"}
                                                                                                </span>
                                                                                            </td>

                                                                                            <td className="px-4 py-3 text-center">
                                                                                                <span className="text-[10px] font-black text-slate-700">
                                                                                                    {
                                                                                                        detalle.nombre
                                                                                                    }
                                                                                                </span>
                                                                                            </td>
                                                                                        </tr>
                                                                                    ),
                                                                                )}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-6 py-20 text-center"
                                            >
                                                <div className="flex flex-col items-center gap-3">
                                                    <Plane
                                                        size={28}
                                                        className="text-slate-300"
                                                    />

                                                    <span className="text-[10px] font-black uppercase text-slate-400">
                                                        No hay registros disponibles
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {meta.last_page > 1 && (
                        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <span className="text-[10px] font-black uppercase text-slate-500">
                                Página {meta.current_page} de{" "}
                                {meta.last_page}
                            </span>

                            <div className="flex gap-1">
                                <button
                                    type="button"
                                    disabled={
                                        pagina === 1 ||
                                        cargando
                                    }
                                    onClick={() =>
                                        setPagina(
                                            (prev) =>
                                                prev - 1,
                                        )
                                    }
                                    className="rounded border border-slate-200 px-3 py-1 text-[10px] font-black uppercase hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Anterior
                                </button>

                                <button
                                    type="button"
                                    disabled={
                                        pagina ===
                                        meta.last_page ||
                                        cargando
                                    }
                                    onClick={() =>
                                        setPagina(
                                            (prev) =>
                                                prev + 1,
                                        )
                                    }
                                    className="rounded border border-slate-200 px-3 py-1 text-[10px] font-black uppercase hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {showForm && (
                    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                            onClick={cerrarModal}
                        />

                        <div
                            className="relative z-10 flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-300"
                            onClick={(event) =>
                                event.stopPropagation()
                            }
                        >
                            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
                                <div>
                                    <h3 className="text-lg font-black uppercase tracking-tighter text-slate-800">
                                        Nueva Pernocta
                                    </h3>

                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                                        Registro de aeronaves en hangares
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={
                                        cerrarModal
                                    }
                                    disabled={
                                        guardando
                                    }
                                    className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-40"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 space-y-5 overflow-y-auto bg-[#f3f4f6] p-4 custom-scrollbar sm:p-6">
                                <PernoctaDiaForm
                                    onAdd={
                                        handleAdd
                                    }
                                />

                                <div>
                                    <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-tight text-slate-800">
                                                Aeronaves agregadas
                                            </h4>

                                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                                {items.length} registros pendientes
                                            </p>
                                        </div>

                                        <div className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-indigo-600 px-2 text-xs font-black text-white">
                                            {items.length}
                                        </div>
                                    </div>

                                    <PernoctaDiaTable
                                        items={items}
                                        onRemove={
                                            handleRemove
                                        }
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
                                <button
                                    type="button"
                                    onClick={
                                        cerrarModal
                                    }
                                    disabled={
                                        guardando
                                    }
                                    className="rounded border border-slate-200 bg-white px-5 py-2.5 text-[10px] font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                >
                                    CANCELAR
                                </button>

                                <button
                                    type="button"
                                    onClick={
                                        handleGuardar
                                    }
                                    disabled={
                                        !items.length ||
                                        guardando
                                    }
                                    className="flex items-center justify-center gap-2 rounded bg-indigo-600 px-5 py-2.5 text-[10px] font-black text-white shadow-md hover:bg-indigo-700 disabled:opacity-40"
                                >
                                    {guardando ? (
                                        <>
                                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                            GUARDANDO
                                        </>
                                    ) : (
                                        <>
                                            <Save
                                                size={14}
                                            />
                                            FINALIZAR Y GUARDAR
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {mostrarModalFecha && (
                    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
                        <div
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() =>
                                setMostrarModalFecha(
                                    false,
                                )
                            }
                        />

                        <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
                                <h3 className="text-sm font-black uppercase text-slate-700">
                                    Período
                                </h3>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setMostrarModalFecha(
                                            false,
                                        )
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
                                            "dia",
                                            "rango",
                                            "mes",
                                            "año",
                                        ] as PeriodoPernocta[]
                                    ).map((modo) => (
                                        <button
                                            key={modo}
                                            type="button"
                                            onClick={() =>
                                                cambiarPeriodo(
                                                    modo,
                                                )
                                            }
                                            className={`flex-1 rounded-md py-2 text-[10px] font-bold uppercase transition-all ${filtrosEdicion.periodo ===
                                                modo
                                                ? "bg-white text-blue-600 shadow-sm"
                                                : "text-slate-500 hover:text-slate-700"
                                                }`}
                                        >
                                            {modo}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-3">
                                    {filtrosEdicion.periodo ===
                                        "dia" && (
                                            <div>
                                                <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">
                                                    Fecha
                                                </label>

                                                <input
                                                    type="date"
                                                    value={
                                                        filtrosEdicion.fechaInicio
                                                    }
                                                    onChange={(
                                                        event,
                                                    ) =>
                                                        seleccionarDia(
                                                            event
                                                                .target
                                                                .value,
                                                        )
                                                    }
                                                    className="w-full rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-blue-400"
                                                />
                                            </div>
                                        )}

                                    {filtrosEdicion.periodo ===
                                        "rango" && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">
                                                        Desde
                                                    </label>

                                                    <input
                                                        type="date"
                                                        value={
                                                            filtrosEdicion.fechaInicio
                                                        }
                                                        onChange={(
                                                            event,
                                                        ) =>
                                                            setFiltrosEdicion(
                                                                (
                                                                    prev,
                                                                ) => ({
                                                                    ...prev,
                                                                    fechaInicio:
                                                                        event
                                                                            .target
                                                                            .value,
                                                                }),
                                                            )
                                                        }
                                                        className="w-full rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-blue-400"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">
                                                        Hasta
                                                    </label>

                                                    <input
                                                        type="date"
                                                        value={
                                                            filtrosEdicion.fechaFin
                                                        }
                                                        onChange={(
                                                            event,
                                                        ) =>
                                                            setFiltrosEdicion(
                                                                (
                                                                    prev,
                                                                ) => ({
                                                                    ...prev,
                                                                    fechaFin:
                                                                        event
                                                                            .target
                                                                            .value,
                                                                }),
                                                            )
                                                        }
                                                        className="w-full rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-blue-400"
                                                    />
                                                </div>
                                            </div>
                                        )}

                                    {filtrosEdicion.periodo ===
                                        "mes" && (
                                            <div>
                                                <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">
                                                    Mes
                                                </label>

                                                <input
                                                    type="month"
                                                    value={obtenerValorMes()}
                                                    onChange={(
                                                        event,
                                                    ) =>
                                                        seleccionarMes(
                                                            event
                                                                .target
                                                                .value,
                                                        )
                                                    }
                                                    className="w-full rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-blue-400"
                                                />
                                            </div>
                                        )}

                                    {filtrosEdicion.periodo ===
                                        "año" && (
                                            <div>
                                                <label className="mb-1 block text-[9px] font-black uppercase text-slate-400">
                                                    Año
                                                </label>

                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={4}
                                                    value={
                                                        anioEdicion
                                                    }
                                                    onChange={(
                                                        event,
                                                    ) =>
                                                        seleccionarAnio(
                                                            event
                                                                .target
                                                                .value,
                                                        )
                                                    }
                                                    placeholder="Ej. 2025"
                                                    className="w-full rounded-lg border border-slate-200 p-2 text-sm outline-none focus:border-blue-400"
                                                />

                                                <p className="mt-1 text-[9px] font-medium text-slate-400">
                                                    Ingresa un año de cuatro dígitos.
                                                </p>
                                            </div>
                                        )}
                                </div>

                                <button
                                    type="button"
                                    onClick={
                                        aplicarFiltroFecha
                                    }
                                    className="w-full rounded-lg bg-slate-800 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-slate-700"
                                >
                                    Aplicar filtro
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <ModalVistaPreviaExcelPernocta
                isOpen={mostrarVistaPreviaExcel}
                onClose={() => {
                    if (
                        cargandoVistaPreviaExcel ||
                        descargandoExcel
                    ) {
                        return;
                    }

                    setMostrarVistaPreviaExcel(false);
                    setRegistrosExcel([]);
                }}
                onConfirm={confirmarDescargaExcel}
                registros={registrosExcel}
                periodo={periodoExcel}
                cargando={cargandoVistaPreviaExcel}
                descargando={descargandoExcel}
            />
        </AppLayout>
    );
}
