/**
 * Acceso a la API de los catálogos de Facturación: los de matrícula (bloque 1a:
 * categorías de aeronave, tipos de motor, precio del combustible y datos de
 * cobro de cada matrícula) y los de la prefacturación (bloque 1b: clientes,
 * servicios y sus categorías, formas de pago y proveedores).
 *
 * Los importes decimales llegan del servidor como texto ("12.50") porque el
 * modelo los castea a decimal; se conservan así para no perder precisión y para
 * distinguir un cero ("0.00", una cortesía) de la ausencia de valor (null).
 */

function getXsrfToken(): string {
    const match = document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='));
    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

const BASE = '/api/facturacion';

/**
 * Error de la API con el código HTTP, el de negocio (ya_desactivada…) y los errores por campo del 422.
 * `cuerpo` es la respuesta entera: algunos códigos de negocio traen datos propios (`sin_cobro` trae `faltante`).
 */
export class ErrorApi extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly codigo: string | null = null,
        public readonly errors: Record<string, string[]> = {},
        public readonly cuerpo: Record<string, unknown> = {},
    ) {
        super(message);
        this.name = 'ErrorApi';
    }
}

/** Lo que se le dice a quien opera cuando el servidor falla (5xx): el cuerpo de un 500 es inglés técnico o un «Server Error» crudo. */
export const MENSAJE_ERROR_DEL_SERVIDOR =
    'El servidor tuvo un problema y no pudo completar la operación. Recarga la prefactura para ver cómo quedó y vuelve a intentarlo; si se repite, avisa a sistemas.';

/**
 * El texto de un error para mostrarlo: un 5xx, un 401/403/404/419/429 y un fallo de red nunca enseñan lo que dijo el framework
 * (inglés); un 422 junta sus errores por campo; lo demás ya trae su mensaje en español escrito por el servidor y se muestra tal cual.
 */
export function mensajeDeError(e: unknown): string {
    if (e instanceof ErrorApi) {
        if (e.status >= 500) return MENSAJE_ERROR_DEL_SERVIDOR;

        // Estos traen el texto del framework, en inglés («Unauthenticated.», «CSRF token mismatch.», «Too Many Attempts.»).
        // El mensaje no promete nada que el llamador pueda no hacer (como recargar).
        switch (e.status) {
            case 401:
                return 'Tu sesión terminó. Vuelve a iniciar sesión y repite la operación.';
            case 403:
                return 'No tienes permiso para hacer esto.';
            case 404:
                return 'Ese registro ya no existe: otra persona pudo quitarlo o cambiarlo.';
            case 419:
                return 'La página caducó. Recárgala (F5) e inténtalo de nuevo; si tenías algo sin guardar, cópialo antes.';
            case 429:
                return 'Se hicieron demasiadas peticiones seguidas. Espera un momento e inténtalo de nuevo.';
        }

        const delCampo = Object.values(e.errors).flat();

        return delCampo.length > 0 ? delCampo.join(' ') : e.message;
    }

    // `fetch` rechaza con un TypeError cuando no hay red («Failed to fetch», «Load failed», «NetworkError…»). Solo ese: un TypeError de código no se disfraza.
    if (e instanceof TypeError && /fetch|network|load failed/i.test(e.message)) return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';

    return e instanceof Error ? e.message : 'Error inesperado';
}

async function leer<T>(res: Response): Promise<T> {
    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const mensaje =
            data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string'
                ? (data as { message: string }).message
                : `Error en el servidor (${res.status})`;

        throw new ErrorApi(
            mensaje,
            res.status,
            (data as { codigo?: string })?.codigo ?? null,
            (data as { errors?: Record<string, string[]> })?.errors ?? {},
            data && typeof data === 'object' ? (data as Record<string, unknown>) : {},
        );
    }

    return data as T;
}

const LECTURA: RequestInit = { headers: { Accept: 'application/json' }, credentials: 'same-origin' };

function escritura(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', cuerpo?: unknown): RequestInit {
    return {
        method,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getXsrfToken() },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        credentials: 'same-origin',
    };
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** 'A' activo, 'N' dado de baja. */
export type StatusCatalogo = 'A' | 'N';

/** Filtro de estado de una pantalla de catálogo: las activas, las de baja o todas. */
export type FiltroEstado = 'activas' | 'baja' | 'todas';

export type CategoriaAeronave = {
    id: number;
    nombre: string;
    tarifa_pernocta: string;
    tarifa_transito_2h: string;
    tarifa_transito_12h: string;
    status: StatusCatalogo;
};

export type TipoMotor = {
    id: number;
    nombre: string;
    tarifa_aterrizaje: string;
    status: StatusCatalogo;
};

export type PrecioCombustible = {
    id: number;
    /** Costo: lo que cuesta el combustible en ASA. */
    precio_asa: string;
    /** Lo que se cobra al cliente. */
    precio_eolo: string;
    /** Fecha de inicio: el servidor la serializa como instante UTC, ver `fechaMexico`. */
    vigencia_inicio: string;
    /** null mientras el precio siga vigente. */
    vigencia_fin: string | null;
    user_id: number | null;
    capturado_por?: { id: number; name: string } | null;
};

/** transito paga estancia; guarda tiene contrato de hangar y no la paga. */
export type EstatusAeronave = 'transito' | 'guarda';

export type AeronaveFacturable = {
    id: number;
    aeronave_id: number;
    matricula: string | null;
    categoria_aeronave_id: number | null;
    categoria: CategoriaAeronave | null;
    tipo_motor_id: number | null;
    tipo_motor: TipoMotor | null;
    estatus: EstatusAeronave;
    cobra_derecho_vuelos: boolean;
    /** Tarifas propias: null significa que la matrícula hereda de su categoría o motor. */
    tarifa_pernocta: string | null;
    tarifa_transito_2h: string | null;
    tarifa_transito_12h: string | null;
    tarifa_aterrizaje: string | null;
    /** Lo que se cobrará: la propia si existe, si no la heredada; null si no hay de dónde. */
    tarifa_pernocta_efectiva: string | null;
    tarifa_transito_2h_efectiva: string | null;
    tarifa_transito_12h_efectiva: string | null;
    tarifa_aterrizaje_efectiva: string | null;
};

/** Cliente de facturación. El RFC puede repetirse (el genérico lo comparten muchos clientes) y puede faltar. */
export type Cliente = {
    id: number;
    nombre: string;
    rfc: string | null;
    correo: string | null;
    telefono: string | null;
    status: StatusCatalogo;
};

/** Clasificación de los servicios; se administra desde la pantalla de servicios. */
export type CategoriaServicio = {
    id: number;
    nombre: string;
    status: StatusCatalogo;
};

/** Cómo se ajusta el precio antes de aplicar el margen; la fórmula vive en `App\Support\ImporteServicio::calcular()` (app/Support/ImporteServicio.php). */
export type AjustePrecio = 'ninguno' | 'mas_5' | 'sin_iva' | 'comision_131';

export type Servicio = {
    id: number;
    categoria_servicio_id: number | null;
    /** Viene en el listado, con su estado (puede estar dada de baja). */
    categoria: CategoriaServicio | null;
    nombre: string;
    /** Decimal de 4 lugares ("1000.0000"); cero es un precio válido. */
    precio_unitario: string;
    es_de_tercero: boolean;
    /** Porcentaje ("50.00"). Es de tercero si y solo si es mayor a 0. */
    margen: string;
    ajuste_precio: AjustePrecio;
    /** Clave interna del servicio especial (combustible, cargos de estancia…); null en los comunes. */
    concepto: string | null;
    status: StatusCatalogo;
};

/** `concepto` es null salvo en las que el sistema identifica: efectivo, Amex y AvCard (con regla de cobro propia) y el saldo a favor (solo se identifica). */
export type ConceptoFormaPago = 'efectivo' | 'amex' | 'avcard' | 'saldo_a_favor';

export type FormaPago = { id: number; nombre: string; concepto: ConceptoFormaPago | null; status: StatusCatalogo };

export type Proveedor = { id: number; nombre: string; status: StatusCatalogo };

export interface Pagina<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

// ---------------------------------------------------------------------------
// Categorías de aeronave y tipos de motor (misma forma, distinto recurso)
// ---------------------------------------------------------------------------

/** Lo que se envía al alta y a la edición: el nombre y los importes ya convertidos a número. */
export type DatosCatalogo = { nombre: string } & Record<string, string | number>;

/** Alta y edición de un cliente: lo opcional vacío viaja como null. */
export type DatosCliente = { nombre: string; rfc: string | null; correo: string | null; telefono: string | null };

/** Alta y edición de un servicio: el precio y el margen ya convertidos a número. */
export type DatosServicio = {
    categoria_servicio_id: number | null;
    nombre: string;
    precio_unitario: number;
    es_de_tercero: boolean;
    margen: number;
    ajuste_precio: AjustePrecio;
};

/** Lo que se puede hacer con un registro de un catálogo, sin importar cómo se lista. */
export interface ApiEscritura<T, D = DatosCatalogo> {
    crear: (datos: D) => Promise<{ message: string; registro: T }>;
    actualizar: (id: number, datos: D) => Promise<{ message: string; registro: T }>;
    /** 409 (ErrorApi.codigo ya_desactivad*) si ya estaba de baja. */
    desactivar: (id: number) => Promise<string>;
    /** 409 (ErrorApi.codigo ya_activ*) si ya estaba activa. */
    reactivar: (id: number) => Promise<string>;
}

export interface ApiCatalogo<T, D = DatosCatalogo> extends ApiEscritura<T, D> {
    /** Todas las filas, activas y de baja: el filtro de baja se resuelve en pantalla. */
    listar: () => Promise<T[]>;
}

function crearApiEscritura<T, D>(ruta: string, claveRegistro: string): ApiEscritura<T, D> {
    const url = `${BASE}/${ruta}`;

    return {
        async crear(datos) {
            const r = await leer<Record<string, unknown> & { message: string }>(await fetch(url, escritura('POST', datos)));
            return { message: r.message, registro: r[claveRegistro] as T };
        },
        async actualizar(id, datos) {
            const r = await leer<Record<string, unknown> & { message: string }>(await fetch(`${url}/${id}`, escritura('PUT', datos)));
            return { message: r.message, registro: r[claveRegistro] as T };
        },
        async desactivar(id) {
            return (await leer<{ message: string }>(await fetch(`${url}/${id}/desactivar`, escritura('PATCH')))).message;
        },
        async reactivar(id) {
            return (await leer<{ message: string }>(await fetch(`${url}/${id}/reactivar`, escritura('PATCH')))).message;
        },
    };
}

function crearApiCatalogo<T, D = DatosCatalogo>(ruta: string, claveLista: string, claveRegistro: string): ApiCatalogo<T, D> {
    return {
        ...crearApiEscritura<T, D>(ruta, claveRegistro),
        async listar() {
            const datos = await leer<Record<string, T[]>>(await fetch(`${BASE}/${ruta}`, LECTURA));
            return datos[claveLista];
        },
    };
}

export const apiCategoriasAeronave = crearApiCatalogo<CategoriaAeronave>('categorias-aeronave', 'categorias', 'categoria');

export const apiTiposMotor = crearApiCatalogo<TipoMotor>('tipos-motor', 'tipos_motor', 'tipo_motor');

// ---------------------------------------------------------------------------
// Catálogos de la prefacturación (bloque 1b): misma forma, distinto recurso.
// Los listados traen todas las filas (activas y de baja) y se filtran en pantalla, salvo clientes, que pagina el servidor.
// ---------------------------------------------------------------------------

/** Clientes no tiene `listar`: su listado es paginado y filtrado por el servidor (`obtenerClientesApi`). */
export const apiClientes = crearApiEscritura<Cliente, DatosCliente>('clientes', 'cliente');

export type FiltrosClientes = {
    /** Búsqueda por nombre o RFC. */
    q: string;
    estado: FiltroEstado;
};

/** La pantalla abre con los clientes activos; los de baja se alcanzan con el filtro de estado para reactivarlos. */
export const FILTROS_CLIENTES_VACIOS: FiltrosClientes = { q: '', estado: 'activas' };

export async function obtenerClientesApi(filtros: FiltrosClientes, pagina: number, porPagina: number): Promise<Pagina<Cliente>> {
    const params = new URLSearchParams({ page: String(pagina), per_page: String(porPagina), estado: filtros.estado });

    if (filtros.q.trim() !== '') params.set('q', filtros.q.trim());

    return leer(await fetch(`${BASE}/clientes?${params.toString()}`, LECTURA));
}

export const apiServicios = crearApiCatalogo<Servicio, DatosServicio>('servicios', 'servicios', 'servicio');

export const apiCategoriasServicio = crearApiCatalogo<CategoriaServicio>('categorias-servicio', 'categorias', 'categoria');

export const apiFormasPago = crearApiCatalogo<FormaPago>('formas-pago', 'formas_pago', 'forma_pago');

export const apiProveedores = crearApiCatalogo<Proveedor>('proveedores', 'proveedores', 'proveedor');

// ---------------------------------------------------------------------------
// Precio del combustible
// ---------------------------------------------------------------------------

export async function obtenerPreciosCombustibleApi(pagina: number, porPagina: number): Promise<Pagina<PrecioCombustible>> {
    const params = new URLSearchParams({ page: String(pagina), per_page: String(porPagina) });

    return leer(await fetch(`${BASE}/precios-combustible?${params.toString()}`, LECTURA));
}

/**
 * El precio en uso (null si todavía no se ha registrado ninguno) y los dos
 * números de la fórmula del precio Eolo, `(ASA + ajuste) × margen`. La fórmula
 * la fija el servidor y viaja siempre, incluso sin precio registrado.
 */
export type PrecioCombustibleVigente = {
    precio: PrecioCombustible | null;
    ajuste: number;
    margen: number;
};

export async function obtenerPrecioCombustibleVigenteApi(): Promise<PrecioCombustibleVigente> {
    return leer(await fetch(`${BASE}/precios-combustible/vigente`, LECTURA));
}

export type NuevoPrecioCombustible = {
    precio_asa: number;
    /** Ausente: el servidor lo calcula con su fórmula. */
    precio_eolo?: number;
};

/** Registrar un precio cierra hoy la vigencia del anterior; no hay edición ni baja. */
export async function registrarPrecioCombustibleApi(datos: NuevoPrecioCombustible): Promise<{ message: string; precio: PrecioCombustible }> {
    return leer(await fetch(`${BASE}/precios-combustible`, escritura('POST', datos)));
}

// ---------------------------------------------------------------------------
// Aeronaves (datos de cobro por matrícula)
// ---------------------------------------------------------------------------

export type FiltrosAeronaves = {
    /** Búsqueda por matrícula. */
    q: string;
    estatus: '' | EstatusAeronave;
    /** Solo las matrículas sin categoría: las que todavía no se pueden facturar. */
    sin_categoria: boolean;
};

export const FILTROS_AERONAVES_VACIOS: FiltrosAeronaves = { q: '', estatus: '', sin_categoria: false };

export async function obtenerAeronavesFacturablesApi(filtros: FiltrosAeronaves, pagina: number, porPagina: number): Promise<Pagina<AeronaveFacturable>> {
    const params = new URLSearchParams({ page: String(pagina), per_page: String(porPagina) });

    if (filtros.q.trim() !== '') params.set('q', filtros.q.trim());
    if (filtros.estatus !== '') params.set('estatus', filtros.estatus);
    if (filtros.sin_categoria) params.set('sin_categoria', '1');

    return leer(await fetch(`${BASE}/aeronaves?${params.toString()}`, LECTURA));
}

/** Los cuatro campos de tarifa propia. */
export type CampoTarifaPropia = 'tarifa_pernocta' | 'tarifa_transito_2h' | 'tarifa_transito_12h' | 'tarifa_aterrizaje';

/**
 * Cambios a una matrícula. `estatus` y `cobra_derecho_vuelos` son obligatorios.
 * Los demás campos tienen tres estados y JSON los distingue bien:
 *   - ausente  → el servidor no toca ese dato;
 *   - null     → se borra (la tarifa propia desaparece y se vuelve a heredar);
 *   - número   → se guarda.
 */
export type CambiosAeronave = {
    estatus: EstatusAeronave;
    cobra_derecho_vuelos: boolean;
    categoria_aeronave_id?: number | null;
    tipo_motor_id?: number | null;
} & Partial<Record<CampoTarifaPropia, number | null>>;

export async function actualizarAeronaveFacturableApi(id: number, cambios: CambiosAeronave): Promise<{ message: string; aeronave: AeronaveFacturable }> {
    return leer(await fetch(`${BASE}/aeronaves/${id}`, escritura('PUT', cambios)));
}

// ---------------------------------------------------------------------------
// Prefacturas (bloque 2)
// ---------------------------------------------------------------------------

interface OpcionesPedir {
    method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: Record<string, unknown>;
}

/** Una petición a la API: sin `method` es una lectura; con él, una escritura con el token CSRF. Lanza `ErrorApi`. */
async function pedir<T>(url: string, { method, body }: OpcionesPedir = {}): Promise<T> {
    return leer<T>(await fetch(url, method ? escritura(method, body) : LECTURA));
}

/** Un pago de la prefactura. `concepto` es null salvo en Efectivo, Amex, AvCard y Saldo a favor. */
export interface PagoPrefactura {
    id: number;
    forma_pago_id: number;
    forma_pago: string | null;
    concepto: ConceptoFormaPago | null;
    monto: string;
    /** true si este pago creó un renglón de comisión: quitarlo también lo quita. */
    es_comision_amex: boolean;
}

/** Lo que recibe «Recalcular estancia». Los ajustes cobran la DIFERENCIA entre dos tramos, no el tramo entero. */
export type DatosEstancia = {
    pernoctas: number;
    transitos_2h: number;
    transitos_12h: number;
    ajustes_2h_12h?: number;
    ajustes_12h_pernocta?: number;
};

/** Un renglón de prefactura: congela el precio, el margen y el ajuste que tenía el servicio al agregarse. */
export interface RenglonPrefactura {
    id: number;
    servicio_id: number;
    nombre_servicio: string;
    precio_unitario: string;
    cantidad: number;
    margen: string;
    ajuste_precio: AjustePrecio;
    /** Los cargos de estancia empiezan por `estancia_`: los reemplaza "Recalcular estancia". */
    concepto: string | null;
    remision: string | null;
    /** null si el servidor no pudo calcularlo (`importe_error` dice por qué). */
    importe: string | null;
    importe_error: string | null;
    /** Un renglón de cortesía se ve en el documento pero su importe es 0.00. */
    es_cortesia: boolean;
    /** Etiqueta del grupo en el que sale el renglón en el documento; null si va suelto. La etiqueta ES la identidad del grupo. */
    grupo: string | null;
}

/** Lo que el sello guardó contra lo que derivan hoy los renglones, por campo. */
export interface DiscrepanciaSello {
    sellado: string | null;
    derivado: string;
}

/**
 * Una versión SUSTITUIDA de una prefactura: el documento tal como salió antes de que se reabriera para corregirlo. Ya no es el vigente.
 * Solo viene en la ficha, y sin el documento: el PDF lo arma el servidor (`urlVersionPrefactura`).
 */
export interface VersionPrefactura {
    version: number;
    /** Cuándo se cerró esa versión. "2026-09-30 14:30:00", sin zona. */
    cerrada_at: string | null;
    total_sellado: string;
    /** Por qué se reabrió: lo que se corrigió. */
    motivo: string;
    reabierta_at: string | null;
}

export interface Prefactura {
    id: number;
    /** null mientras es borrador: el folio se consume al cerrar. Una reabierta CONSERVA el suyo. */
    folio: number | null;
    /** `reabierta`: una cerrada que se abrió para corregirla; tiene folio, no se imprime ni se cotiza hasta volver a cerrarla. */
    estado: 'borrador' | 'cerrada' | 'reabierta';
    /** 'N' es un borrador descartado. */
    status: StatusCatalogo;
    matricula: string | null;
    cliente: string | null;
    cliente_id: number | null;
    aeronave_id: number;
    /** "2026-09-30 14:30:00", sin zona: tal como la guarda el servidor. */
    llegada_at: string | null;
    salida_at: string | null;
    origen: string | null;
    destino: string | null;
    tipo_destino: 'nacional' | 'internacional';
    /** Los totales los calcula siempre el servidor; null si no pudo (`totales_error` dice por qué). */
    subtotal: string | null;
    iva: string | null;
    iva_tasa: string | null;
    total: string | null;
    totales_error: string | null;
    /** true: el sello de una cerrada ya no coincide con sus renglones. null: no se pudo verificar (ver `sello_error`). */
    sello_discrepa: boolean | null;
    /** El servidor lo serializa como `[]` cuando no hay discrepancias y como objeto cuando las hay. */
    sello_discrepancias: Record<string, DiscrepanciaSello> | never[];
    sello_error: string | null;
    cerrada_at: string | null;
    nota_interna: string | null;
    nota_externa: string | null;
    nota_factura: string | null;
    /**
     * El cobro. Solo viene en la ficha, no en el listado.
     * Si los totales no se pudieron calcular (`cobro_error` dice por qué), `por_cobrar`, `sobrepago`, `cambio` y
     * `cobrado_de_mas` vienen en null; `pagado` no depende de la tasa de IVA y sí trae su número.
     */
    pagos: PagoPrefactura[];
    pagado: string;
    por_cobrar: string | null;
    sobrepago: string | null;
    /** Lo que se devuelve. Nunca pasa del efectivo cobrado. */
    cambio: string | null;
    /** El resto del sobrepago: no se devuelve, se corrige el pago. */
    cobrado_de_mas: string | null;
    cobro_error: string | null;
    /** Solo en la ficha, no en el listado. */
    renglones?: RenglonPrefactura[];
    /** Solo en la ficha: las versiones sustituidas, de la 1 en adelante. Vacía si nunca se reabrió. */
    versiones?: VersionPrefactura[];
}

export interface FiltrosPrefactura {
    /** Matrícula, cliente o folio. */
    q: string;
    estado: '' | 'borrador' | 'cerrada' | 'reabierta';
    desde: string;
    hasta: string;
}

/** La lista abre con los borradores, que es el trabajo pendiente. */
export const FILTROS_PREFACTURA_VACIOS: FiltrosPrefactura = { q: '', estado: 'borrador', desde: '', hasta: '' };

export async function obtenerPrefacturasApi(filtros: FiltrosPrefactura, pagina: number, porPagina: number): Promise<Pagina<Prefactura>> {
    const params = new URLSearchParams({ page: String(pagina), per_page: String(porPagina) });

    if (filtros.q.trim() !== '') params.set('q', filtros.q.trim());
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.desde) params.set('desde', filtros.desde);
    if (filtros.hasta) params.set('hasta', filtros.hasta);

    return pedir<Pagina<Prefactura>>(`${BASE}/prefacturas?${params.toString()}`);
}

/**
 * El PDF y la cotización NO se piden con `pedir()`: se abren en una pestaña, porque son archivos y no JSON.
 * La sesión viaja en la cookie de Sanctum, así que un `window.open` basta y no hace falta montar una descarga por `fetch`.
 * El documento es el de una cerrada (con el sello roto o sin verificar el servidor responde 409 o 422); la cotización, el de un borrador.
 */
export const urlDocumentoPrefactura = (id: number) => `${BASE}/prefacturas/${id}/pdf`;
export const urlCotizacionPrefactura = (id: number) => `${BASE}/prefacturas/${id}/cotizacion`;
/** El papel de una versión sustituida: lleva la marca de «no vigente» y no se puede confundir con el documento vigente. */
export const urlVersionPrefactura = (id: number, version: number) => `${BASE}/prefacturas/${id}/versiones/${version}/pdf`;

export const apiPrefacturas = {
    ficha: (id: number) => pedir<{ prefactura: Prefactura }>(`${BASE}/prefacturas/${id}`),
    crear: (datos: Record<string, unknown>) => pedir<{ prefactura: Prefactura }>(`${BASE}/prefacturas`, { method: 'POST', body: datos }),
    editar: (id: number, datos: Record<string, unknown>) => pedir<{ prefactura: Prefactura }>(`${BASE}/prefacturas/${id}`, { method: 'PUT', body: datos }),
    /**
     * Sin `confirmarSinCobro`, el servidor rechaza (422, ErrorApi.codigo `sin_cobro`, con `cuerpo.faltante`) si los pagos no cubren el total.
     * Solo se manda `true` cuando quien opera confirmó ESE aviso, y con `faltanteConfirmado` —la cifra que vio—: el servidor la compara con
     * el faltante real dentro del cierre y, si ya es otro, responde `sin_cobro` con el nuevo en lugar de cerrar.
     */
    cerrar: (id: number, confirmarSinCobro = false, faltanteConfirmado?: string) =>
        pedir<{ prefactura: Prefactura; message: string }>(`${BASE}/prefacturas/${id}/cerrar`, {
            method: 'PATCH',
            body: faltanteConfirmado === undefined ? { confirmar_sin_cobro: confirmarSinCobro } : { confirmar_sin_cobro: confirmarSinCobro, faltante_confirmado: faltanteConfirmado },
        }),
    agregarPago: (id: number, datos: { forma_pago_id: number; monto: string }) =>
        pedir<{ message: string; pago_id: number; prefactura: Prefactura }>(`${BASE}/prefacturas/${id}/pagos`, { method: 'POST', body: datos }),
    /** `monto` es lo que se carga a la tarjeta; el servidor agrega la comisión como renglón y devuelve la suya (`comision`). */
    agregarPagoAmex: (id: number, monto: string) =>
        pedir<{ message: string; pago_id: number; comision: string; prefactura: Prefactura }>(`${BASE}/prefacturas/${id}/pagos/amex`, { method: 'POST', body: { monto } }),
    /** Si el pago creó una comisión Amex, se quita con él. */
    quitarPago: (id: number, pago: number) => pedir<{ message: string; prefactura: Prefactura }>(`${BASE}/prefacturas/${id}/pagos/${pago}`, { method: 'DELETE' }),
    /** Una clave ausente deja la nota como estaba; `null` la vacía. */
    guardarNotas: (id: number, datos: { nota_interna?: string | null; nota_externa?: string | null; nota_factura?: string | null }) =>
        pedir<{ message: string; prefactura: Prefactura }>(`${BASE}/prefacturas/${id}/notas`, { method: 'PATCH', body: datos }),
    /** `grupo` es la etiqueta; `null` desagrupa. El servidor lee una cadena vacía como `null`: quien llame debe exigir una etiqueta no vacía antes de agrupar. */
    grupo: (id: number, renglon: number, grupo: string | null) =>
        pedir<{ message: string; prefactura: Prefactura }>(`${BASE}/prefacturas/${id}/renglones/${renglon}/grupo`, { method: 'PATCH', body: { grupo } }),
    cortesia: (id: number, renglon: number, esCortesia: boolean) =>
        pedir<{ message: string; prefactura: Prefactura }>(`${BASE}/prefacturas/${id}/renglones/${renglon}/cortesia`, { method: 'PATCH', body: { es_cortesia: esCortesia } }),
    agregarRenglon: (id: number, datos: Record<string, unknown>) => pedir<{ renglon_id: number }>(`${BASE}/prefacturas/${id}/renglones`, { method: 'POST', body: datos }),
    quitarRenglon: (id: number, renglon: number) => pedir<{ message: string }>(`${BASE}/prefacturas/${id}/renglones/${renglon}`, { method: 'DELETE' }),
    /** Los dos ajustes son opcionales: ausentes cuentan 0. */
    estancia: (id: number, datos: DatosEstancia) => pedir<{ renglones: number; motivo: string | null }>(`${BASE}/prefacturas/${id}/estancia`, { method: 'PATCH', body: datos }),
    /** `motivo` llega cuando el paquete no se agregó completo; con `renglones` 0 el destino sigue nacional. */
    internacional: (id: number) => pedir<{ renglones: number; motivo: string | null }>(`${BASE}/prefacturas/${id}/internacional`, { method: 'PATCH' }),
    /**
     * Reabre una cerrada para corregirla (exige el subdepartamento `factReabrirPrefactura`: sin él, 403). El documento actual queda como versión.
     * Errores de negocio: `no_reabrible` (409, no está cerrada), `totales_no_calculables` (422); el motivo, de 10 a 500 caracteres, falla con 422 por campo.
     */
    reabrir: (id: number, motivo: string) => pedir<{ prefactura: Prefactura; message: string }>(`${BASE}/prefacturas/${id}/reabrir`, { method: 'PATCH', body: { motivo } }),
    /** Baja lógica de un borrador. 409 (ErrorApi.codigo ya_cerrada o ya_descartada) si ya no es un borrador activo. */
    descartar: (id: number) => pedir<{ message: string }>(`${BASE}/prefacturas/${id}/descartar`, { method: 'PATCH' }),
};

/** Una llegada de Operaciones Diarias, la que la prefactura puede ofrecer para precargar fecha, hora y lugar. */
export interface LlegadaOperacion {
    id: number;
    matricula: string;
    /** Instante UTC (el servidor castea la fecha): ver `fechaIsoMexico`. */
    fecha: string;
    /** "14:30:00". */
    hora: string;
    /** De dónde venía; null si no se capturó. */
    lugar: string | null;
}

/**
 * Las llegadas más recientes de una matrícula que todavía NO tienen prefactura, de la más reciente a la más antigua.
 * El servidor hace la coincidencia exacta de la matrícula, deja fuera las operaciones canceladas y las ya tomadas por
 * una prefactura activa (borrador o cerrada); una prefactura descartada no reserva su operación.
 */
export async function obtenerLlegadasDeMatriculaApi(matricula: string, maximo = 5): Promise<LlegadaOperacion[]> {
    const params = new URLSearchParams({ matricula, max: String(maximo) });

    return (await pedir<{ data: LlegadaOperacion[] }>(`${BASE}/prefacturas/llegadas-sin-facturar?${params.toString()}`)).data;
}
