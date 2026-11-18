import type {
    DetalleRelevo,
    FilaRelevo,
    FiltrosRelevo,
    PayloadRelevo,
    PayloadRelevoNuevo,
    PendienteRelevo,
} from '@/pages/seguridad/entregaTurno/types';

const BASE = '/api/EntregaTurnoSeguridad';

function getXsrfToken(): string {
    const match = document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

/**
 * Un error que conserva el estado y los errores por campo.
 *
 * Un `Error` pelado con solo el mensaje no sirve: el formulario no podría
 * pintar «la firma no llegó en un formato válido» junto a su campo, ni distinguir un 403 —no tienes permiso— de
 * un 404 —alguien ya lo borró— de un 422. Y el servidor manda los tres con
 * la misma forma `{ message }`, así que sin el estado son indistinguibles.
 */
export class ErrorDeApi extends Error {
    constructor(
        mensaje: string,
        public readonly status: number,
        public readonly errors: Record<string, string[]> = {},
    ) {
        super(mensaje);
        this.name = 'ErrorDeApi';
    }
}

async function leerJson(res: Response, mensajeDeError: string) {
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new ErrorDeApi(data?.message || mensajeDeError, res.status, data?.errors ?? {});
    }

    return data;
}

export type ListadoRelevos = {
    data: FilaRelevo[];
    meta: { current_page: number; last_page: number; per_page: number; total: number };
};

export async function fetchRelevos(filtros: FiltrosRelevo): Promise<ListadoRelevos> {
    const qs = new URLSearchParams();

    Object.entries(filtros).forEach(([clave, valor]) => {
        if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
            qs.set(clave, String(valor));
        }
    });

    const query = qs.toString();

    const res = await fetch(`${BASE}${query ? `?${query}` : ''}`, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    });

    return leerJson(res, 'No se pudo cargar la lista de relevos');
}

export async function fetchRelevo(id: number): Promise<{ data: DetalleRelevo }> {
    const res = await fetch(`${BASE}/${id}`, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    });

    return leerJson(res, 'No se pudo cargar el relevo');
}

export async function fetchPendientesRelevo(): Promise<{ data: PendienteRelevo[] }> {
    const res = await fetch(`${BASE}/pendientes`, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    });

    return leerJson(res, 'No se pudieron cargar los pendientes');
}

export async function guardarRelevo(form: PayloadRelevoNuevo): Promise<{ message: string; data: DetalleRelevo }> {
    const res = await fetch(BASE, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': getXsrfToken(),
        },
        body: JSON.stringify(form),
        credentials: 'same-origin',
    });

    return leerJson(res, 'No se pudo guardar el relevo');
}

export async function actualizarRelevo(id: number, form: PayloadRelevo): Promise<{ message: string; data: DetalleRelevo }> {
    const res = await fetch(`${BASE}/${id}`, {
        method: 'PUT',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': getXsrfToken(),
        },
        body: JSON.stringify(form),
        credentials: 'same-origin',
    });

    return leerJson(res, 'No se pudo actualizar el relevo');
}

export async function eliminarRelevo(id: number): Promise<{ message: string }> {
    const res = await fetch(`${BASE}/eliminar/${id}`, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
    });

    return leerJson(res, 'No se pudo eliminar el relevo');
}
