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
    RefreshCcw,
    RotateCcw,
    Search,
    User,
    X,
} from "lucide-react";
import {
    type ReactNode,
    useEffect,
    useMemo,
    useState,
} from "react";

type Props = {
    open: boolean;
    onClose: () => void;
    modulo?: string;
    titulo?: string;
    subtitulo?: string;
    mostrarFiltroModulo?: boolean;
};

type UsuarioBitacora = {
    id: number;
    name: string;
    email?: string | null;
};

type DatosBitacora =
    | Record<string, unknown>
    | string
    | null;

export type BitacoraItem = {
    id: number;
    fecha?: string | null;
    hora?: string | null;
    modulo?: string | null;
    accion?: string | null;
    registro_id?: number | null;
    descripcion?: string | null;
    datos_anteriores?: DatosBitacora;
    datos_nuevos?: DatosBitacora;
    usuario_id?: number | null;
    elabora?: string | null;
    usuario?: UsuarioBitacora | null;
    created_at?: string | null;
    updated_at?: string | null;
};

type BitacoraResponse = {
    current_page: number;
    data: BitacoraItem[];
    from: number | null;
    last_page: number;
    per_page: number;
    to: number | null;
    total: number;
};

type FiltrosResponse = {
    modulos: string[];
    acciones: string[];
};

type BitacoraParams = {
    page: number;
    per_page: number;
    q?: string;
    modulo?: string;
    accion?: string;
    desde?: string;
    hasta?: string;
};

type PaginaElemento = number | "ellipsis";

type ComparacionCambio = {
    seccion: string;
    campo: string;
    anterior: unknown;
    nuevo: unknown;
};

async function fetchBitacoras(
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

    const data = await response
        .json()
        .catch(() => null);

    if (!response.ok) {
        throw new Error(
            data?.message ??
                "No se pudo cargar la bitácora.",
        );
    }

    return data;
}

async function fetchFiltrosBitacora(
    signal?: AbortSignal,
): Promise<FiltrosResponse> {
    const response = await fetch(
        "/api/bitacoras/filtros",
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

    const data = await response
        .json()
        .catch(() => null);

    if (!response.ok) {
        throw new Error(
            data?.message ??
                "No se pudieron cargar los filtros.",
        );
    }

    return {
        modulos: data?.modulos ?? [],
        acciones: data?.acciones ?? [],
    };
}

function normalizarValor(
    valor?: string | null,
): string {
    return valor?.trim().toUpperCase() ?? "";
}

function obtenerEstiloAccion(
    accion?: string | null,
): string {
    switch (normalizarValor(accion)) {
        case "CREAR":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";

        case "ACTUALIZAR":
            return "border-blue-200 bg-blue-50 text-blue-700";

        case "ELIMINAR":
            return "border-red-200 bg-red-50 text-red-700";

        case "ACTIVAR":
            return "border-violet-200 bg-violet-50 text-violet-700";

        case "DESACTIVAR":
            return "border-orange-200 bg-orange-50 text-orange-700";

        case "FIRMAR":
            return "border-indigo-200 bg-indigo-50 text-indigo-700";

        case "EXPORTAR":
            return "border-amber-200 bg-amber-50 text-amber-700";

        case "CONSULTAR":
            return "border-cyan-200 bg-cyan-50 text-cyan-700";

        default:
            return "border-slate-200 bg-slate-50 text-slate-600";
    }
}

function formatearFecha(
    fecha?: string | null,
): string {
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

function formatearHora(
    hora?: string | null,
): string {
    if (!hora) {
        return "-";
    }

    return hora.substring(0, 5);
}

function obtenerNombreUsuario(
    row: BitacoraItem,
): string {
    return (
        row.usuario?.name ??
        row.elabora ??
        "Sistema"
    );
}

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

    const paginas: PaginaElemento[] = [1];

    if (paginaActual > 4) {
        paginas.push("ellipsis");
    }

    const inicio = Math.max(
        2,
        paginaActual - 1,
    );

    const fin = Math.min(
        ultimaPagina - 1,
        paginaActual + 1,
    );

    for (
        let pagina = inicio;
        pagina <= fin;
        pagina++
    ) {
        paginas.push(pagina);
    }

    if (paginaActual < ultimaPagina - 3) {
        paginas.push("ellipsis");
    }

    paginas.push(ultimaPagina);

    return paginas;
}

function esObjeto(
    valor: unknown,
): valor is Record<string, unknown> {
    return (
        typeof valor === "object" &&
        valor !== null &&
        !Array.isArray(valor)
    );
}

function convertirObjeto(
    valor?: DatosBitacora,
): Record<string, unknown> {
    if (!valor) {
        return {};
    }

    if (esObjeto(valor)) {
        return valor;
    }

    if (typeof valor !== "string") {
        return {};
    }

    try {
        const resultado = JSON.parse(valor);

        return esObjeto(resultado)
            ? resultado
            : {};
    } catch {
        return {};
    }
}

function normalizarComparacion(
    valor: unknown,
): unknown {
    if (valor === undefined) {
        return null;
    }

    if (Array.isArray(valor)) {
        return valor.map(normalizarComparacion);
    }

    if (esObjeto(valor)) {
        return Object.keys(valor)
            .sort()
            .reduce<Record<string, unknown>>(
                (resultado, llave) => {
                    resultado[llave] =
                        normalizarComparacion(
                            valor[llave],
                        );

                    return resultado;
                },
                {},
            );
    }

    return valor;
}

function sonIguales(
    anterior: unknown,
    nuevo: unknown,
): boolean {
    return (
        JSON.stringify(
            normalizarComparacion(anterior),
        ) ===
        JSON.stringify(
            normalizarComparacion(nuevo),
        )
    );
}

function agregarComparacionesRecursivas(
    anterior: unknown,
    nuevo: unknown,
    seccion: string,
    ruta: string,
    comparaciones: ComparacionCambio[],
): void {
    if (sonIguales(anterior, nuevo)) {
        return;
    }

    if (
        Array.isArray(anterior) ||
        Array.isArray(nuevo)
    ) {
        const arregloAnterior = Array.isArray(anterior)
            ? anterior
            : [];

        const arregloNuevo = Array.isArray(nuevo)
            ? nuevo
            : [];

        const longitud = Math.max(
            arregloAnterior.length,
            arregloNuevo.length,
        );

        for (
            let indice = 0;
            indice < longitud;
            indice++
        ) {
            const nuevaRuta = ruta
                ? `${ruta}.${indice + 1}`
                : `${indice + 1}`;

            agregarComparacionesRecursivas(
                arregloAnterior[indice],
                arregloNuevo[indice],
                seccion,
                nuevaRuta,
                comparaciones,
            );
        }

        return;
    }

    if (
        esObjeto(anterior) ||
        esObjeto(nuevo)
    ) {
        const objetoAnterior = esObjeto(anterior)
            ? anterior
            : {};

        const objetoNuevo = esObjeto(nuevo)
            ? nuevo
            : {};

        const campos = Array.from(
            new Set([
                ...Object.keys(objetoAnterior),
                ...Object.keys(objetoNuevo),
            ]),
        );

        campos.forEach((campo) => {
            const nuevaRuta = ruta
                ? `${ruta}.${campo}`
                : campo;

            agregarComparacionesRecursivas(
                objetoAnterior[campo],
                objetoNuevo[campo],
                seccion,
                nuevaRuta,
                comparaciones,
            );
        });

        return;
    }

    comparaciones.push({
        seccion,
        campo: ruta || seccion,
        anterior,
        nuevo,
    });
}

function obtenerComparaciones(
    datosAnteriores?: DatosBitacora,
    datosNuevos?: DatosBitacora,
): ComparacionCambio[] {
    const anteriores = convertirObjeto(
        datosAnteriores,
    );

    const nuevos = convertirObjeto(
        datosNuevos,
    );

    const secciones = Array.from(
        new Set([
            ...Object.keys(anteriores),
            ...Object.keys(nuevos),
        ]),
    );

    const comparaciones: ComparacionCambio[] = [];

    secciones.forEach((seccion) => {
        agregarComparacionesRecursivas(
            anteriores[seccion],
            nuevos[seccion],
            seccion,
            "",
            comparaciones,
        );
    });

    return comparaciones;
}

function nombreLegible(
    valor: string,
): string {
    const etiquetas: Record<string, string> = {
        datos_principales: "Datos principales",
        checklist: "Checklist",
        marcas_danio: "Marcas de daño",
        imagenes: "Fotografías",
        firmas: "Firmas",
        fecha: "Fecha",
        hora: "Hora",
        movimiento: "Movimiento",
        matricula: "Matrícula",
        tipo: "Tipo de aeronave",
        tipo_aeronave: "Tipo",
        destino: "Destino",
        procedensia: "Procedencia",
        procedencia: "Procedencia",
        observaciones: "Observaciones",
        responsable: "Responsable",
        jefe_area: "Jefe de área",
        fbo: "FBO",
        numero_estaticas: "Número de estáticas",
        checklist_avion: "Checklist de avión",
        checklist_helicoptero:
            "Checklist de helicóptero",
        cantidad: "Cantidad",
        agregadas: "Elementos agregados",
        actualizadas: "Elementos actualizados",
        imagen_id: "ID de imagen",
        tag: "Etiqueta",
        orden: "Orden",
        descripcion: "Descripción",
        severidad: "Severidad",
        validaciones: "Validaciones",
        equipo: "Equipo",
        lugar: "Procedencia o destino",
        pax: "Pasajeros",
        equipaje: "Equipaje",
        tipo_cliente: "Tipo de cliente",
        tipo_operacion: "Tipo de operación",
        nombre: "Nombre",
        impulso: "Impulso",
        departamento: "Departamento",
        x: "Posición X",
        y: "Posición Y",
        z: "Posición Z",
    };

    return valor
        .split(".")
        .map((parte) => {
            if (/^\d+$/.test(parte)) {
                return `Elemento ${parte}`;
            }

            if (etiquetas[parte]) {
                return etiquetas[parte];
            }

            return parte
                .replace(/_/g, " ")
                .replace(/\b\w/g, (letra) =>
                    letra.toUpperCase(),
                );
        })
        .join(" › ");
}

function valorVacio(
    valor: unknown,
): boolean {
    return (
        valor === null ||
        valor === undefined ||
        valor === ""
    );
}

function textoValor(
    valor: unknown,
): string {
    if (valorVacio(valor)) {
        return "Sin valor";
    }

    if (typeof valor === "boolean") {
        return valor ? "Sí" : "No";
    }

    if (
        typeof valor === "string" ||
        typeof valor === "number"
    ) {
        return String(valor);
    }

    try {
        return JSON.stringify(valor, null, 2);
    } catch {
        return String(valor);
    }
}

export default function BitacoraModal({
    open,
    onClose,
    modulo,
    titulo,
    subtitulo = "Historial de actividades del sistema",
    mostrarFiltroModulo = true,
}: Props) {
    const moduloFijo = modulo
        ? modulo.trim().toUpperCase()
        : "";

    const [rows, setRows] = useState<
        BitacoraItem[]
    >([]);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] = useState<
        string | null
    >(null);

    const [q, setQ] = useState("");

    const [qDebounced, setQDebounced] =
        useState("");

    const [
        moduloSeleccionado,
        setModuloSeleccionado,
    ] = useState("");

    const [accion, setAccion] =
        useState("");

    const [desde, setDesde] =
        useState("");

    const [hasta, setHasta] =
        useState("");

    const [modulos, setModulos] = useState<
        string[]
    >([]);

    const [acciones, setAcciones] = useState<
        string[]
    >([]);

    const [page, setPage] = useState(1);

    const [perPage, setPerPage] =
        useState(20);

    const [lastPage, setLastPage] =
        useState(1);

    const [total, setTotal] = useState(0);

    const [from, setFrom] = useState<
        number | null
    >(null);

    const [to, setTo] = useState<
        number | null
    >(null);

    const [detalle, setDetalle] =
        useState<BitacoraItem | null>(null);

    const [reloadKey, setReloadKey] =
        useState(0);

    const tituloModal =
        titulo ??
        (moduloFijo
            ? `Bitácora ${moduloFijo}`
            : "Bitácora general");

    useEffect(() => {
        const timeout = window.setTimeout(
            () => {
                setQDebounced(q.trim());
                setPage(1);
            },
            400,
        );

        return () => {
            window.clearTimeout(timeout);
        };
    }, [q]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const controller =
            new AbortController();

        fetchFiltrosBitacora(controller.signal)
            .then((response) => {
                setModulos(
                    response.modulos ?? [],
                );

                setAcciones(
                    response.acciones ?? [],
                );
            })
            .catch((errorPeticion) => {
                if (
                    errorPeticion instanceof
                        DOMException &&
                    errorPeticion.name ===
                        "AbortError"
                ) {
                    return;
                }

                console.error(errorPeticion);
            });

        return () => {
            controller.abort();
        };
    }, [open]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const controller =
            new AbortController();

        const cargarBitacora = async () => {
            setLoading(true);
            setError(null);

            try {
                const response =
                    await fetchBitacoras(
                        {
                            page,
                            per_page: perPage,
                            q: qDebounced,
                            modulo:
                                moduloFijo ||
                                moduloSeleccionado,
                            accion,
                            desde,
                            hasta,
                        },
                        controller.signal,
                    );

                setRows(response.data ?? []);

                setLastPage(
                    Math.max(
                        response.last_page ?? 1,
                        1,
                    ),
                );

                setTotal(response.total ?? 0);
                setFrom(response.from ?? null);
                setTo(response.to ?? null);

                if (
                    page >
                    response.last_page
                ) {
                    setPage(
                        Math.max(
                            response.last_page,
                            1,
                        ),
                    );
                }
            } catch (errorPeticion) {
                if (
                    errorPeticion instanceof
                        DOMException &&
                    errorPeticion.name ===
                        "AbortError"
                ) {
                    return;
                }

                setRows([]);

                setError(
                    errorPeticion instanceof Error
                        ? errorPeticion.message
                        : "Ocurrió un error al cargar la bitácora.",
                );
            } finally {
                if (
                    !controller.signal.aborted
                ) {
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
        moduloFijo,
        moduloSeleccionado,
        accion,
        desde,
        hasta,
        reloadKey,
    ]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const manejarEscape = (
            event: KeyboardEvent,
        ) => {
            if (event.key !== "Escape") {
                return;
            }

            if (detalle) {
                setDetalle(null);
                return;
            }

            onClose();
        };

        window.addEventListener(
            "keydown",
            manejarEscape,
        );

        return () => {
            window.removeEventListener(
                "keydown",
                manejarEscape,
            );
        };
    }, [open, detalle, onClose]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const overflowAnterior =
            document.body.style.overflow;

        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow =
                overflowAnterior;
        };
    }, [open]);

    const paginas = useMemo(
        () =>
            generarPaginas(
                page,
                lastPage,
            ),
        [page, lastPage],
    );

    const comparacionesDetalle = useMemo(
        () =>
            detalle
                ? obtenerComparaciones(
                      detalle.datos_anteriores,
                      detalle.datos_nuevos,
                  )
                : [],
        [detalle],
    );

    const existenFiltros =
        q !== "" ||
        moduloSeleccionado !== "" ||
        accion !== "" ||
        desde !== "" ||
        hasta !== "";

    const limpiarFiltros = () => {
        setQ("");
        setQDebounced("");
        setModuloSeleccionado("");
        setAccion("");
        setDesde("");
        setHasta("");
        setPage(1);
    };

    const cambiarPagina = (
        nuevaPagina: number,
    ) => {
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/20 p-3 backdrop-blur-sm md:p-6"
            onMouseDown={(event) => {
                if (
                    event.target ===
                    event.currentTarget
                ) {
                    onClose();
                }
            }}
        >
            <div className="relative flex max-h-[95vh] w-full max-w-[1450px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 md:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600">
                            <ClipboardList size={20} />
                        </div>

                        <div className="min-w-0">
                            <h2 className="truncate text-base font-black uppercase tracking-tight text-slate-800 md:text-lg">
                                {tituloModal}
                            </h2>

                            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                {subtitulo}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-red-600"
                        title="Cerrar"
                    >
                        <X size={18} />
                    </button>
                </header>

                <section className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 md:px-6">
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
                        <div
                            className={`relative ${
                                !moduloFijo &&
                                mostrarFiltroModulo
                                    ? "lg:col-span-4"
                                    : "lg:col-span-5"
                            }`}
                        >
                            <Search
                                size={15}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <input
                                type="text"
                                value={q}
                                onChange={(event) =>
                                    setQ(
                                        event.target.value,
                                    )
                                }
                                placeholder="Buscar usuario, módulo, acción o descripción..."
                                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                            />

                            {q && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setQ("")
                                    }
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {!moduloFijo &&
                            mostrarFiltroModulo && (
                                <select
                                    value={
                                        moduloSeleccionado
                                    }
                                    onChange={(event) => {
                                        setModuloSeleccionado(
                                            event.target
                                                .value,
                                        );

                                        setPage(1);
                                    }}
                                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-[10px] font-bold uppercase text-slate-600 outline-none focus:border-blue-400 lg:col-span-2"
                                >
                                    <option value="">
                                        Todos los módulos
                                    </option>

                                    {modulos.map(
                                        (moduloItem) => (
                                            <option
                                                key={
                                                    moduloItem
                                                }
                                                value={
                                                    moduloItem
                                                }
                                            >
                                                {moduloItem}
                                            </option>
                                        ),
                                    )}
                                </select>
                            )}

                        <select
                            value={accion}
                            onChange={(event) => {
                                setAccion(
                                    event.target.value,
                                );

                                setPage(1);
                            }}
                            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-[10px] font-bold uppercase text-slate-600 outline-none focus:border-blue-400 lg:col-span-2"
                        >
                            <option value="">
                                Todas las acciones
                            </option>

                            {acciones.map(
                                (accionItem) => (
                                    <option
                                        key={accionItem}
                                        value={accionItem}
                                    >
                                        {accionItem}
                                    </option>
                                ),
                            )}
                        </select>

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
                                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-2 text-xs font-semibold text-slate-600 outline-none focus:border-blue-400"
                                title="Fecha inicial"
                            />
                        </div>

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
                                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-2 text-xs font-semibold text-slate-600 outline-none focus:border-blue-400"
                                title="Fecha final"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={limpiarFiltros}
                            disabled={!existenFiltros}
                            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-[10px] font-bold uppercase text-slate-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 lg:col-span-1"
                            title="Limpiar filtros"
                        >
                            <RotateCcw size={14} />
                        </button>
                    </div>
                </section>

                <section className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3 md:px-6">
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <p className="text-[10px] font-bold uppercase text-slate-500">
                            Total:
                            <span className="ml-1 text-slate-800">
                                {total}
                            </span>
                        </p>

                        <p className="text-[10px] font-bold uppercase text-slate-500">
                            Página:
                            <span className="ml-1 text-slate-800">
                                {page} de {lastPage}
                            </span>
                        </p>

                        <p className="text-[10px] font-bold uppercase text-slate-500">
                            Mostrando:
                            <span className="ml-1 text-slate-800">
                                {from ?? 0} - {to ?? 0}
                            </span>
                        </p>
                    </div>

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
                        className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[10px] font-bold text-slate-600 outline-none"
                    >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </section>

                <main className="min-h-0 flex-1 overflow-auto bg-white">
                    <table className="w-full min-w-[1100px] border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-50">
                            <tr className="border-b border-slate-200">
                                <th className="w-16 px-4 py-3 text-center text-[9px] font-black uppercase tracking-wider text-slate-500">
                                    #
                                </th>

                                <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-wider text-slate-500">
                                    Fecha
                                </th>

                                <th className="px-4 py-3 text-center text-[9px] font-black uppercase tracking-wider text-slate-500">
                                    Hora
                                </th>

                                <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-wider text-slate-500">
                                    Módulo
                                </th>

                                <th className="px-4 py-3 text-center text-[9px] font-black uppercase tracking-wider text-slate-500">
                                    Acción
                                </th>

                                <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-wider text-slate-500">
                                    Registro
                                </th>

                                <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-wider text-slate-500">
                                    Descripción
                                </th>

                                <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-wider text-slate-500">
                                    Usuario
                                </th>

                                <th className="w-24 px-4 py-3 text-center text-[9px] font-black uppercase tracking-wider text-slate-500">
                                    Detalle
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {loading && (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="h-80 text-center"
                                    >
                                        <Loader2
                                            size={30}
                                            className="mx-auto animate-spin text-blue-500"
                                        />

                                        <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            Cargando registros
                                        </p>
                                    </td>
                                </tr>
                            )}

                            {!loading && error && (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="h-80 px-6 text-center"
                                    >
                                        <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-5">
                                            <p className="text-sm font-black text-red-700">
                                                No se pudo cargar
                                            </p>

                                            <p className="mt-1 text-xs text-red-600">
                                                {error}
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setReloadKey(
                                                        (
                                                            valor,
                                                        ) =>
                                                            valor +
                                                            1,
                                                    )
                                                }
                                                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-[10px] font-bold uppercase text-red-700 hover:bg-red-100"
                                            >
                                                <RefreshCcw
                                                    size={14}
                                                />

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
                                            colSpan={9}
                                            className="h-80 text-center"
                                        >
                                            <ClipboardList
                                                size={38}
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
                                rows.map(
                                    (
                                        row,
                                        index,
                                    ) => {
                                        const numero =
                                            (page -
                                                1) *
                                                perPage +
                                            index +
                                            1;

                                        return (
                                            <tr
                                                key={row.id}
                                                className="border-b border-slate-100 bg-white transition hover:bg-slate-50"
                                            >
                                                <td className="px-4 py-3 text-center text-[10px] font-bold text-slate-400">
                                                    {numero}
                                                </td>

                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <CalendarDays
                                                            size={
                                                                14
                                                            }
                                                            className="shrink-0 text-slate-400"
                                                        />

                                                        <span className="whitespace-nowrap text-xs font-semibold text-slate-700">
                                                            {formatearFecha(
                                                                row.fecha,
                                                            )}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3 text-center">
                                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                                                        <Clock3
                                                            size={
                                                                13
                                                            }
                                                        />

                                                        {formatearHora(
                                                            row.hora,
                                                        )}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <span className="text-[10px] font-bold uppercase text-slate-700">
                                                        {row.modulo ??
                                                            "-"}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3 text-center">
                                                    <span
                                                        className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-black uppercase ${obtenerEstiloAccion(
                                                            row.accion,
                                                        )}`}
                                                    >
                                                        {row.accion ??
                                                            "SIN ACCIÓN"}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <span className="text-xs font-semibold text-slate-600">
                                                        {row.registro_id
                                                            ? `#${row.registro_id}`
                                                            : "-"}
                                                    </span>
                                                </td>

                                                <td className="max-w-[430px] px-4 py-3">
                                                    <p
                                                        className="line-clamp-2 text-xs leading-5 text-slate-600"
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
                                                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500">
                                                            <User
                                                                size={
                                                                    14
                                                                }
                                                            />
                                                        </div>

                                                        <div className="min-w-0">
                                                            <p className="max-w-[170px] truncate text-xs font-bold text-slate-700">
                                                                {obtenerNombreUsuario(
                                                                    row,
                                                                )}
                                                            </p>

                                                            {row
                                                                .usuario
                                                                ?.email && (
                                                                <p className="max-w-[170px] truncate text-[9px] text-slate-400">
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
                                                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[9px] font-bold uppercase text-slate-600 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
                                                    >
                                                        <Eye
                                                            size={
                                                                13
                                                            }
                                                        />

                                                        Ver
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    },
                                )}
                        </tbody>
                    </table>
                </main>

                <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                    <p className="text-[10px] font-bold uppercase text-slate-500">
                        Mostrando{" "}
                        <span className="text-slate-800">
                            {from ?? 0}
                        </span>{" "}
                        a{" "}
                        <span className="text-slate-800">
                            {to ?? 0}
                        </span>{" "}
                        de{" "}
                        <span className="text-slate-800">
                            {total}
                        </span>{" "}
                        registros
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-1">
                        <PaginacionBoton
                            disabled={
                                page <= 1 ||
                                loading
                            }
                            onClick={() =>
                                cambiarPagina(1)
                            }
                            title="Primera página"
                        >
                            <ChevronsLeft size={15} />
                        </PaginacionBoton>

                        <PaginacionBoton
                            disabled={
                                page <= 1 ||
                                loading
                            }
                            onClick={() =>
                                cambiarPagina(
                                    page - 1,
                                )
                            }
                            title="Página anterior"
                        >
                            <ChevronLeft size={15} />
                        </PaginacionBoton>

                        {paginas.map(
                            (
                                pagina,
                                index,
                            ) => {
                                if (
                                    pagina ===
                                    "ellipsis"
                                ) {
                                    return (
                                        <span
                                            key={`ellipsis-${index}`}
                                            className="flex h-8 w-8 items-center justify-center text-xs font-bold text-slate-400"
                                        >
                                            …
                                        </span>
                                    );
                                }

                                return (
                                    <button
                                        type="button"
                                        key={pagina}
                                        disabled={loading}
                                        onClick={() =>
                                            cambiarPagina(
                                                pagina,
                                            )
                                        }
                                        className={`flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[10px] font-bold transition ${
                                            pagina === page
                                                ? "border-blue-500 bg-blue-500 text-white"
                                                : "border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-700"
                                        }`}
                                    >
                                        {pagina}
                                    </button>
                                );
                            },
                        )}

                        <PaginacionBoton
                            disabled={
                                page >=
                                    lastPage ||
                                loading
                            }
                            onClick={() =>
                                cambiarPagina(
                                    page + 1,
                                )
                            }
                            title="Página siguiente"
                        >
                            <ChevronRight size={15} />
                        </PaginacionBoton>

                        <PaginacionBoton
                            disabled={
                                page >=
                                    lastPage ||
                                loading
                            }
                            onClick={() =>
                                cambiarPagina(
                                    lastPage,
                                )
                            }
                            title="Última página"
                        >
                            <ChevronsRight size={15} />
                        </PaginacionBoton>
                    </div>
                </footer>
            </div>

            {detalle && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-slate-900/30 p-3 backdrop-blur-sm md:p-6"
                    onMouseDown={(event) => {
                        if (
                            event.target ===
                            event.currentTarget
                        ) {
                            setDetalle(null);
                        }
                    }}
                >
                    <div className="my-auto flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-4 md:px-6">
                            <div>
                                <h3 className="text-base font-black uppercase text-slate-800">
                                    Detalle de bitácora
                                </h3>

                                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                    Bitácora #{detalle.id}
                                    {detalle.registro_id
                                        ? ` · Registro #${detalle.registro_id}`
                                        : ""}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setDetalle(null)
                                }
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-red-600"
                            >
                                <X size={18} />
                            </button>
                        </header>

                        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-5 md:p-6">
                            <div className="overflow-hidden rounded-lg border border-slate-200">
                                <table className="w-full border-collapse">
                                    <tbody>
                                        <FilaDetalle
                                            titulo="Fecha"
                                            valor={formatearFecha(
                                                detalle.fecha,
                                            )}
                                        />

                                        <FilaDetalle
                                            titulo="Hora"
                                            valor={formatearHora(
                                                detalle.hora,
                                            )}
                                        />

                                        <FilaDetalle
                                            titulo="Módulo"
                                            valor={
                                                detalle.modulo ??
                                                "-"
                                            }
                                        />

                                        <FilaDetalle
                                            titulo="Acción"
                                            valor={
                                                detalle.accion ??
                                                "-"
                                            }
                                        />

                                        <FilaDetalle
                                            titulo="Registro relacionado"
                                            valor={
                                                detalle.registro_id
                                                    ? `#${detalle.registro_id}`
                                                    : "-"
                                            }
                                        />

                                        <FilaDetalle
                                            titulo="Usuario"
                                            valor={obtenerNombreUsuario(
                                                detalle,
                                            )}
                                        />

                                        <tr className="border-t border-slate-200">
                                            <th className="w-52 bg-slate-50 px-4 py-3 text-left align-top text-[10px] font-black uppercase text-slate-500">
                                                Descripción
                                            </th>

                                            <td className="whitespace-pre-wrap px-4 py-3 text-sm leading-6 text-slate-700">
                                                {detalle.descripcion ??
                                                    "Sin descripción"}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {comparacionesDetalle.length >
                                0 && (
                                <section className="mt-6">
                                    <div className="mb-3">
                                        <h4 className="text-sm font-black uppercase text-slate-800">
                                            Cambios realizados
                                        </h4>

                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                            Valores anteriores y
                                            valores nuevos
                                        </p>
                                    </div>

                                    <div className="overflow-auto rounded-lg border border-slate-200">
                                        <table className="w-full min-w-[800px] border-collapse">
                                            <thead className="bg-slate-50">
                                                <tr className="border-b border-slate-200">
                                                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase text-slate-500">
                                                        Sección
                                                    </th>

                                                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase text-slate-500">
                                                        Campo
                                                    </th>

                                                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase text-slate-500">
                                                        Valor anterior
                                                    </th>

                                                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase text-slate-500">
                                                        Valor nuevo
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {comparacionesDetalle.map(
                                                    (
                                                        cambio,
                                                        index,
                                                    ) => (
                                                        <tr
                                                            key={`${cambio.seccion}-${cambio.campo}-${index}`}
                                                            className="border-b border-slate-100 last:border-b-0"
                                                        >
                                                            <td className="px-4 py-3 text-xs font-bold text-slate-700">
                                                                {nombreLegible(
                                                                    cambio.seccion,
                                                                )}
                                                            </td>

                                                            <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                                                                {nombreLegible(
                                                                    cambio.campo,
                                                                )}
                                                            </td>

                                                            <td className="max-w-[280px] bg-red-50/50 px-4 py-3 align-top text-xs font-semibold text-red-700">
                                                                <ValorTabla
                                                                    valor={
                                                                        cambio.anterior
                                                                    }
                                                                />
                                                            </td>

                                                            <td className="max-w-[280px] bg-emerald-50/50 px-4 py-3 align-top text-xs font-semibold text-emerald-700">
                                                                <ValorTabla
                                                                    valor={
                                                                        cambio.nuevo
                                                                    }
                                                                />
                                                            </td>
                                                        </tr>
                                                    ),
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            )}

                            {comparacionesDetalle.length ===
                                0 &&
                                normalizarValor(
                                    detalle.accion,
                                ) ===
                                    "ACTUALIZAR" && (
                                    <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                                        <p className="text-xs font-semibold text-amber-700">
                                            Este registro no contiene
                                            valores anteriores y nuevos
                                            para comparar.
                                        </p>
                                    </div>
                                )}
                        </div>

                        <footer className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-5 py-4 md:px-6">
                            <button
                                type="button"
                                onClick={() =>
                                    setDetalle(null)
                                }
                                className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-[10px] font-bold uppercase text-slate-600 transition hover:bg-slate-50"
                            >
                                Cerrar
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </div>
    );
}

function FilaDetalle({
    titulo,
    valor,
}: {
    titulo: string;
    valor: string | number;
}) {
    return (
        <tr className="border-t border-slate-200 first:border-t-0">
            <th className="w-52 bg-slate-50 px-4 py-3 text-left text-[10px] font-black uppercase text-slate-500">
                {titulo}
            </th>

            <td className="px-4 py-3 text-sm font-semibold text-slate-700">
                {valor}
            </td>
        </tr>
    );
}

function ValorTabla({
    valor,
}: {
    valor: unknown;
}) {
    if (valorVacio(valor)) {
        return (
            <span className="italic text-slate-400">
                Sin valor
            </span>
        );
    }

    if (
        Array.isArray(valor) ||
        esObjeto(valor)
    ) {
        return (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-5">
                {textoValor(valor)}
            </pre>
        );
    }

    return (
        <span className="whitespace-pre-wrap break-words">
            {textoValor(valor)}
        </span>
    );
}

function PaginacionBoton({
    children,
    disabled,
    onClick,
    title,
}: {
    children: ReactNode;
    disabled: boolean;
    onClick: () => void;
    title: string;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            title={title}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-500 transition hover:border-blue-400 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
            {children}
        </button>
    );
}
