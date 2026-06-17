import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ClipboardList,
    Clock3,
    Eye,
    Loader2,
    RotateCcw,
    Search,
    User,
    X,
} from "lucide-react";
import {
    useEffect,
    useMemo,
    useState,
} from "react";

import type {
    WalkAroundBitacora as BitacoraItem,
} from "@/stores/apiWalkaround";

type Props = {
    open: boolean;
    onClose: () => void;
};

type UsuarioBitacora = {
    id?: number;
    name?: string;
    email?: string;
};

type BitacoraRow = BitacoraItem & {
    usuario?: UsuarioBitacora | null;
    created_at?: string | null;
    updated_at?: string | null;
};

type BitacoraResponse = {
    current_page: number;
    data: BitacoraRow[];
    first_page_url?: string | null;
    from: number | null;
    last_page: number;
    last_page_url?: string | null;
    next_page_url?: string | null;
    path?: string;
    per_page: number;
    prev_page_url?: string | null;
    to: number | null;
    total: number;
};

type BitacoraParams = {
    page: number;
    per_page: number;
    q?: string;
    accion?: string;
    desde?: string;
    hasta?: string;
};

type PaginaElemento = number | "ellipsis";

/* =========================================================
   API
========================================================= */

async function fetchWalkaroundBitacora(
    params: BitacoraParams,
    signal?: AbortSignal,
): Promise<BitacoraResponse> {
    const queryString = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (
            value !== undefined &&
            value !== null &&
            value !== ""
        ) {
            queryString.set(key, String(value));
        }
    });

    const response = await fetch(
        `/api/bitacoras?${queryString.toString()}`,

        {
            method: "GET",
            headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
            credentials: "same-origin",
            signal,
        },
    );

    if (!response.ok) {
        let message = "No se pudo cargar la bitácora.";

        try {
            const errorResponse = await response.json();

            if (errorResponse?.message) {
                message = errorResponse.message;
            }
        } catch {
            // Se conserva el mensaje predeterminado.
        }

        throw new Error(message);
    }

    return response.json();
}

/* =========================================================
   UTILIDADES
========================================================= */

function normalizarAccion(accion?: string | null): string {
    return accion?.trim().toUpperCase() ?? "";
}

function obtenerEstiloAccion(accion?: string | null): string {
    switch (normalizarAccion(accion)) {
        case "CREAR":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";

        case "ACTUALIZAR":
            return "border-blue-200 bg-blue-50 text-blue-700";

        case "ELIMINAR":
            return "border-red-200 bg-red-50 text-red-700";

        case "ACTIVAR":
            return "border-purple-200 bg-purple-50 text-purple-700";

        default:
            return "border-slate-200 bg-slate-100 text-slate-600";
    }
}

function formatearFecha(fecha?: string | null): string {
    if (!fecha) {
        return "-";
    }

    const fechaSinHora = fecha.split("T")[0];
    const partes = fechaSinHora.split("-");

    if (partes.length !== 3) {
        return fecha;
    }

    const [anio, mes, dia] = partes.map(Number);

    const fechaLocal = new Date(
        anio,
        mes - 1,
        dia,
    );

    return fechaLocal.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function formatearHora(hora?: string | null): string {
    if (!hora) {
        return "-";
    }

    return hora.substring(0, 5);
}

function obtenerNombreUsuario(row: BitacoraRow): string {
    return (
        row.usuario?.name ??
        row.elabora ??
        "Usuario no disponible"
    );
}

/**
 * Genera una lista como:
 * 1 2 3 ... 10
 * 1 ... 4 5 6 ... 10
 */
function generarPaginas(
    paginaActual: number,
    ultimaPagina: number,
): PaginaElemento[] {
    if (ultimaPagina <= 7) {
        return Array.from(
            { length: ultimaPagina },
            (_, index) => index + 1,
        );
    }

    const paginas: PaginaElemento[] = [];

    paginas.push(1);

    if (paginaActual > 4) {
        paginas.push("ellipsis");
    }

    const inicio = Math.max(2, paginaActual - 1);
    const fin = Math.min(
        ultimaPagina - 1,
        paginaActual + 1,
    );

    for (let pagina = inicio; pagina <= fin; pagina++) {
        paginas.push(pagina);
    }

    if (paginaActual < ultimaPagina - 3) {
        paginas.push("ellipsis");
    }

    paginas.push(ultimaPagina);

    return paginas;
}

/* =========================================================
   COMPONENTE
========================================================= */

export default function WalkAroundBitacora({
    open,
    onClose,
}: Props) {
    const [rows, setRows] = useState<BitacoraRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filtros
    const [q, setQ] = useState("");
    const [qDebounced, setQDebounced] = useState("");
    const [accion, setAccion] = useState("");
    const [desde, setDesde] = useState("");
    const [hasta, setHasta] = useState("");

    // Paginación
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [from, setFrom] = useState<number | null>(null);
    const [to, setTo] = useState<number | null>(null);

    // Detalle
    const [detalle, setDetalle] =
        useState<BitacoraRow | null>(null);

    /*
     * Retraso en el buscador para evitar una petición
     * por cada tecla presionada.
     */
    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setQDebounced(q.trim());
            setPage(1);
        }, 400);

        return () => {
            window.clearTimeout(timeout);
        };
    }, [q]);

    /*
     * Cargar registros.
     */
    useEffect(() => {
        if (!open) {
            return;
        }

        const controller = new AbortController();

        const cargarBitacora = async () => {
            setLoading(true);
            setError(null);

            try {
                const response =
                    await fetchWalkaroundBitacora(
                        {
                            page,
                            per_page: perPage,
                            q: qDebounced,
                            accion,
                            desde,
                            hasta,
                        },
                        controller.signal,
                    );

                setRows(response.data ?? []);
                setLastPage(response.last_page ?? 1);
                setTotal(response.total ?? 0);
                setFrom(response.from ?? null);
                setTo(response.to ?? null);

                /*
                 * Si se eliminan registros y la página actual
                 * deja de existir, regresar a la última página.
                 */
                if (
                    response.last_page > 0 &&
                    page > response.last_page
                ) {
                    setPage(response.last_page);
                }
            } catch (errorPeticion) {
                if (
                    errorPeticion instanceof DOMException &&
                    errorPeticion.name === "AbortError"
                ) {
                    return;
                }

                console.error(errorPeticion);

                setRows([]);

                setError(
                    errorPeticion instanceof Error
                        ? errorPeticion.message
                        : "Ocurrió un error al cargar la bitácora.",
                );
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        cargarBitacora();

        return () => {
            controller.abort();
        };
    }, [
        open,
        page,
        perPage,
        qDebounced,
        accion,
        desde,
        hasta,
    ]);

    /*
     * Cerrar con Escape.
     */
    useEffect(() => {
        if (!open) {
            return;
        }

        const manejarEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") {
                return;
            }

            if (detalle) {
                setDetalle(null);
                return;
            }

            onClose();
        };

        window.addEventListener("keydown", manejarEscape);

        return () => {
            window.removeEventListener(
                "keydown",
                manejarEscape,
            );
        };
    }, [open, detalle, onClose]);

    const paginas = useMemo(
        () => generarPaginas(page, lastPage),
        [page, lastPage],
    );

    const existenFiltros =
        q !== "" ||
        accion !== "" ||
        desde !== "" ||
        hasta !== "";

    const limpiarFiltros = () => {
        setQ("");
        setQDebounced("");
        setAccion("");
        setDesde("");
        setHasta("");
        setPage(1);
    };

    const cambiarPagina = (nuevaPagina: number) => {
        if (
            nuevaPagina < 1 ||
            nuevaPagina > lastPage ||
            nuevaPagina === page
        ) {
            return;
        }

        setPage(nuevaPagina);
    };

    if (!open) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm md:p-6"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                {/* Header */}
                <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 md:px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
                            <ClipboardList size={21} />
                        </div>

                        <div>
                            <h2 className="text-base font-black uppercase tracking-tight text-white md:text-lg">
                                Bitácora WalkAround
                            </h2>

                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                Historial de acciones del sistema
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                        title="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Resumen */}
                <div className="grid shrink-0 grid-cols-1 gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:grid-cols-3 md:px-6">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Total de registros
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-800">
                            {total.toLocaleString("es-MX")}
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Página actual
                        </p>
                        <p className="mt-1 text-xl font-black text-indigo-600">
                            {page}
                            <span className="ml-1 text-xs text-slate-400">
                                de {lastPage}
                            </span>
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Registros mostrados
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-800">
                            {from ?? 0}
                            <span className="mx-1 text-xs text-slate-400">
                                a
                            </span>
                            {to ?? 0}
                        </p>
                    </div>
                </div>

                {/* Filtros */}
                <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 md:px-6">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                        {/* Buscador */}
                        <div className="relative lg:col-span-4">
                            <Search
                                size={15}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <input
                                type="text"
                                value={q}
                                onChange={(event) =>
                                    setQ(event.target.value)
                                }
                                placeholder="Buscar módulo, acción, usuario..."
                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-9 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                            />

                            {q && (
                                <button
                                    type="button"
                                    onClick={() => setQ("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Acción */}
                        <div className="lg:col-span-2">
                            <select
                                value={accion}
                                onChange={(event) => {
                                    setAccion(
                                        event.target.value,
                                    );
                                    setPage(1);
                                }}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold uppercase text-slate-600 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                            >
                                <option value="">
                                    Todas las acciones
                                </option>
                                <option value="CREAR">
                                    Crear
                                </option>
                                <option value="ACTUALIZAR">
                                    Actualizar
                                </option>
                                <option value="ELIMINAR">
                                    Eliminar
                                </option>
                                <option value="ACTIVAR">
                                    Activar
                                </option>
                            </select>
                        </div>

                        {/* Desde */}
                        <div className="relative lg:col-span-2">
                            <CalendarDays
                                size={14}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <input
                                type="date"
                                value={desde}
                                onChange={(event) => {
                                    setDesde(
                                        event.target.value,
                                    );
                                    setPage(1);
                                }}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-2 text-xs font-semibold text-slate-600 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                                title="Fecha inicial"
                            />
                        </div>

                        {/* Hasta */}
                        <div className="relative lg:col-span-2">
                            <CalendarDays
                                size={14}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <input
                                type="date"
                                value={hasta}
                                min={desde || undefined}
                                onChange={(event) => {
                                    setHasta(
                                        event.target.value,
                                    );
                                    setPage(1);
                                }}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-2 text-xs font-semibold text-slate-600 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                                title="Fecha final"
                            />
                        </div>

                        {/* Limpiar */}
                        <div className="lg:col-span-2">
                            <button
                                type="button"
                                onClick={limpiarFiltros}
                                disabled={!existenFiltros}
                                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-wider text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <RotateCcw size={14} />
                                Limpiar
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tabla */}
                <div className="min-h-0 flex-1 overflow-auto bg-white">
                    <table className="w-full min-w-[1050px] border-collapse text-left">
                        <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
                            <tr>
                                <th className="w-14 px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    #
                                </th>

                                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    Fecha
                                </th>

                                <th className="px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    Hora
                                </th>

                                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    Módulo
                                </th>

                                <th className="px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    Acción
                                </th>

                                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    Descripción
                                </th>

                                <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    Usuario
                                </th>

                                <th className="w-24 px-4 py-3 text-center text-[9px] font-black uppercase tracking-widest text-slate-500">
                                    Detalle
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="py-24 text-center"
                                    >
                                        <Loader2
                                            size={32}
                                            className="mx-auto animate-spin text-indigo-500"
                                        />

                                        <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Cargando bitácora
                                        </p>
                                    </td>
                                </tr>
                            )}

                            {!loading && error && (
                                <tr>
                                    <td
                                        colSpan={8}
                                        className="px-6 py-20 text-center"
                                    >
                                        <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-5">
                                            <p className="text-sm font-black text-red-700">
                                                No se pudo cargar la
                                                bitácora
                                            </p>

                                            <p className="mt-1 text-xs text-red-600">
                                                {error}
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setError(null);
                                                    setPage(1);
                                                    setQDebounced(
                                                        q.trim(),
                                                    );
                                                }}
                                                className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white hover:bg-red-700"
                                            >
                                                Reintentar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}

                            {!loading &&
                                !error &&
                                rows.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={8}
                                            className="px-6 py-24 text-center"
                                        >
                                            <ClipboardList
                                                size={40}
                                                className="mx-auto text-slate-300"
                                            />

                                            <p className="mt-3 text-sm font-black uppercase text-slate-600">
                                                Sin registros
                                            </p>

                                            <p className="mt-1 text-xs text-slate-400">
                                                No existen resultados
                                                para los filtros
                                                seleccionados.
                                            </p>
                                        </td>
                                    </tr>
                                )}

                            {!loading &&
                                !error &&
                                rows.map((row, index) => {
                                    const numeroRegistro =
                                        (page - 1) *
                                            perPage +
                                        index +
                                        1;

                                    return (
                                        <tr
                                            key={row.id}
                                            className="border-b border-slate-100 transition-colors hover:bg-indigo-50/40"
                                        >
                                            <td className="px-4 py-3 text-center text-[10px] font-black text-slate-400">
                                                {numeroRegistro}
                                            </td>

                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                                                        <CalendarDays
                                                            size={14}
                                                        />
                                                    </div>

                                                    <span className="whitespace-nowrap text-xs font-bold capitalize text-slate-700">
                                                        {formatearFecha(
                                                            row.fecha,
                                                        )}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-4 py-3 text-center">
                                                <div className="inline-flex items-center gap-1 text-xs font-black text-slate-600">
                                                    <Clock3
                                                        size={13}
                                                        className="text-slate-400"
                                                    />

                                                    {formatearHora(
                                                        row.hora,
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-4 py-3">
                                                <span className="text-xs font-black uppercase text-slate-700">
                                                    {row.modulo ??
                                                        "-"}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3 text-center">
                                                <span
                                                    className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${obtenerEstiloAccion(
                                                        row.accion,
                                                    )}`}
                                                >
                                                    {row.accion ??
                                                        "SIN ACCIÓN"}
                                                </span>
                                            </td>

                                            <td className="max-w-[360px] px-4 py-3">
                                                <p
                                                    className="truncate text-xs font-medium text-slate-600"
                                                    title={
                                                        row.descripcion ??
                                                        ""
                                                    }
                                                >
                                                    {row.descripcion ??
                                                        "Sin descripción"}
                                                </p>
                                            </td>

                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                                                        <User
                                                            size={14}
                                                        />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="max-w-[180px] truncate text-xs font-black text-slate-700">
                                                            {obtenerNombreUsuario(
                                                                row,
                                                            )}
                                                        </p>

                                                        {row.usuario
                                                            ?.email && (
                                                            <p className="max-w-[180px] truncate text-[9px] font-semibold text-slate-400">
                                                                {
                                                                    row
                                                                        .usuario
                                                                        .email
                                                                }
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-4 py-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setDetalle(
                                                            row,
                                                        )
                                                    }
                                                    className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-indigo-600 transition hover:bg-indigo-600 hover:text-white"
                                                >
                                                    <Eye
                                                        size={13}
                                                    />
                                                    Ver
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>

                {/* Footer y paginación */}
                <div className="flex shrink-0 flex-col gap-4 border-t border-slate-200 bg-slate-50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between md:px-6">
                    <div className="flex flex-wrap items-center gap-4">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            Mostrando{" "}
                            <span className="text-slate-800">
                                {from ?? 0}
                            </span>{" "}
                            -{" "}
                            <span className="text-slate-800">
                                {to ?? 0}
                            </span>{" "}
                            de{" "}
                            <span className="text-slate-800">
                                {total}
                            </span>
                        </p>

                        <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-500">
                            Mostrar

                            <select
                                value={perPage}
                                onChange={(event) => {
                                    setPerPage(
                                        Number(
                                            event.target.value,
                                        ),
                                    );
                                    setPage(1);
                                }}
                                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-indigo-400"
                            >
                                <option value={10}>
                                    10
                                </option>
                                <option value={20}>
                                    20
                                </option>
                                <option value={30}>
                                    30
                                </option>
                                <option value={50}>
                                    50
                                </option>
                            </select>
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-1">
                        {/* Primera página */}
                        <button
                            type="button"
                            disabled={
                                page <= 1 || loading
                            }
                            onClick={() =>
                                cambiarPagina(1)
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Primera página"
                        >
                            <ChevronsLeft size={15} />
                        </button>

                        {/* Anterior */}
                        <button
                            type="button"
                            disabled={
                                page <= 1 || loading
                            }
                            onClick={() =>
                                cambiarPagina(page - 1)
                            }
                            className="flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[9px] font-black uppercase text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronLeft size={14} />
                            <span className="hidden sm:inline">
                                Anterior
                            </span>
                        </button>

                        {/* Números */}
                        {paginas.map(
                            (
                                paginaElemento,
                                index,
                            ) => {
                                if (
                                    paginaElemento ===
                                    "ellipsis"
                                ) {
                                    return (
                                        <span
                                            key={`ellipsis-${index}`}
                                            className="flex h-8 w-8 items-center justify-center text-xs font-black text-slate-400"
                                        >
                                            …
                                        </span>
                                    );
                                }

                                const paginaActiva =
                                    paginaElemento ===
                                    page;

                                return (
                                    <button
                                        type="button"
                                        key={
                                            paginaElemento
                                        }
                                        disabled={
                                            loading
                                        }
                                        onClick={() =>
                                            cambiarPagina(
                                                paginaElemento,
                                            )
                                        }
                                        className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[10px] font-black transition ${
                                            paginaActiva
                                                ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                                                : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                                        }`}
                                    >
                                        {
                                            paginaElemento
                                        }
                                    </button>
                                );
                            },
                        )}

                        {/* Siguiente */}
                        <button
                            type="button"
                            disabled={
                                page >= lastPage ||
                                loading
                            }
                            onClick={() =>
                                cambiarPagina(page + 1)
                            }
                            className="flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[9px] font-black uppercase text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <span className="hidden sm:inline">
                                Siguiente
                            </span>
                            <ChevronRight size={14} />
                        </button>

                        {/* Última página */}
                        <button
                            type="button"
                            disabled={
                                page >= lastPage ||
                                loading
                            }
                            onClick={() =>
                                cambiarPagina(lastPage)
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                            title="Última página"
                        >
                            <ChevronsRight size={15} />
                        </button>
                    </div>
                </div>

                {/* Modal de detalle */}
                {detalle && (
                    <div
                        className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
                        onMouseDown={(event) => {
                            if (
                                event.target ===
                                event.currentTarget
                            ) {
                                setDetalle(null);
                            }
                        }}
                    >
                        <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-tight text-white">
                                        Detalle de bitácora
                                    </h3>

                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                        Registro #
                                        {detalle.id}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setDetalle(null)
                                    }
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <DetalleCampo
                                        titulo="Fecha"
                                        valor={formatearFecha(
                                            detalle.fecha,
                                        )}
                                    />

                                    <DetalleCampo
                                        titulo="Hora"
                                        valor={formatearHora(
                                            detalle.hora,
                                        )}
                                    />

                                    <DetalleCampo
                                        titulo="Módulo"
                                        valor={
                                            detalle.modulo ??
                                            "-"
                                        }
                                    />

                                    <DetalleCampo
                                        titulo="Acción"
                                        valor={
                                            detalle.accion ??
                                            "-"
                                        }
                                    />

                                    <DetalleCampo
                                        titulo="Usuario"
                                        valor={obtenerNombreUsuario(
                                            detalle,
                                        )}
                                    />

                                    <DetalleCampo
                                        titulo="Correo"
                                        valor={
                                            detalle.usuario
                                                ?.email ??
                                            "-"
                                        }
                                    />
                                </div>

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
                                        Descripción
                                    </p>

                                    <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-slate-700">
                                        {detalle.descripcion ??
                                            "Sin descripción"}
                                    </p>
                                </div>

                                <details className="rounded-xl border border-slate-200 bg-white">
                                    <summary className="cursor-pointer px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-600">
                                        Ver información completa
                                    </summary>

                                    <pre className="max-h-72 overflow-auto border-t border-slate-200 bg-slate-950 p-4 text-[10px] text-slate-200">
                                        {JSON.stringify(
                                            detalle,
                                            null,
                                            2,
                                        )}
                                    </pre>
                                </details>
                            </div>

                            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setDetalle(null)
                                    }
                                    className="rounded-lg bg-slate-800 px-5 py-2 text-[10px] font-black uppercase tracking-wider text-white transition hover:bg-slate-700"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* =========================================================
   COMPONENTE CAMPO DE DETALLE
========================================================= */

function DetalleCampo({
    titulo,
    valor,
}: {
    titulo: string;
    valor: string | number;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                {titulo}
            </p>

            <p className="mt-1 break-words text-sm font-black text-slate-700">
                {valor}
            </p>
        </div>
    );
}
