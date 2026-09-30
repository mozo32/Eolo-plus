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

/** Error de la API con el código HTTP, el de negocio (ya_desactivada…) y los errores por campo del 422. */
export class ErrorApi extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly codigo: string | null = null,
        public readonly errors: Record<string, string[]> = {},
    ) {
        super(message);
        this.name = 'ErrorApi';
    }
}

async function leer<T>(res: Response): Promise<T> {
    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const mensaje =
            data && typeof data === 'object' && 'message' in data && typeof (data as { message: unknown }).message === 'string'
                ? (data as { message: string }).message
                : `Error en el servidor (${res.status})`;

        throw new ErrorApi(mensaje, res.status, (data as { codigo?: string })?.codigo ?? null, (data as { errors?: Record<string, string[]> })?.errors ?? {});
    }

    return data as T;
}

const LECTURA: RequestInit = { headers: { Accept: 'application/json' }, credentials: 'same-origin' };

function escritura(method: 'POST' | 'PUT' | 'PATCH', cuerpo?: unknown): RequestInit {
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

/** Cómo se ajusta el precio antes de aplicar el margen; la fórmula vive en `FactServicio::aplicarAjuste()`. */
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
    status: StatusCatalogo;
};

export type FormaPago = { id: number; nombre: string; status: StatusCatalogo };

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
