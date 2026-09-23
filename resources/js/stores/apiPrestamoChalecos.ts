import type { FiltrosPrestamos, PrestamoChaleco, UsuarioTrafico } from '@/pages/Trafico/prestamoChalecos/types';

function getXsrfToken(): string {
    const match = document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='));
    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

const BASE = '/api/PrestamoChalecos';

/** Error de la API con el código HTTP y el de negocio (por ejemplo, ya_devuelto). */
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

export interface PaginaPrestamos {
    data: PrestamoChaleco[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export async function obtenerPrestamosChalecosApi(
    filtros: FiltrosPrestamos,
    pagina: number,
    porPagina: number,
): Promise<PaginaPrestamos> {
    const params = new URLSearchParams({ page: String(pagina), per_page: String(porPagina) });

    // `periodo` solo organiza la interfaz: al backend viajan las fechas resueltas.
    (['nombre', 'fecha_inicio', 'fecha_fin', 'estado'] as const).forEach(clave => {
        if (filtros[clave]) params.set(clave, filtros[clave]);
    });

    const res = await fetch(`${BASE}?${params.toString()}`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
    });

    return leer<PaginaPrestamos>(res);
}

export async function obtenerPersonalTraficoApi(): Promise<UsuarioTrafico[]> {
    const res = await fetch(`${BASE}/personal`, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
    });

    const lista = await leer<{ id: number; name: string }[]>(res);

    return lista.map(usuario => ({ id: usuario.id, nombre: usuario.name }));
}

export interface NuevoPrestamo {
    fecha: string;
    nombre_recibe: string;
    usuario_entrega_id: number;
    foto_ine: File;
}

/** La foto viaja como multipart; el navegador pone el boundary. */
export async function guardarPrestamoChalecoApi(datos: NuevoPrestamo): Promise<{ message: string; prestamo: PrestamoChaleco }> {
    const formData = new FormData();
    formData.append('fecha', datos.fecha);
    formData.append('nombre_recibe', datos.nombre_recibe);
    formData.append('usuario_entrega_id', String(datos.usuario_entrega_id));
    formData.append('foto_ine', datos.foto_ine, datos.foto_ine.name);

    const res = await fetch(BASE, {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-XSRF-TOKEN': getXsrfToken() },
        body: formData,
        credentials: 'same-origin',
    });

    return leer(res);
}

export async function devolverChalecoApi(id: number): Promise<{ message: string; prestamo: PrestamoChaleco }> {
    const res = await fetch(`${BASE}/${id}/devolver`, {
        method: 'PATCH',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getXsrfToken() },
        credentials: 'same-origin',
    });

    return leer(res);
}

/** URL protegida de la INE: solo responde con sesión. */
export const urlFotoIne = (id: number): string => `${BASE}/${id}/ine`;
