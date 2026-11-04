import type {
    DetalleRelevo,
    FilaRelevo,
    FiltrosRelevo,
    PendienteRelevo,
} from '@/pages/seguridad/entregaTurno/types';

const BASE = '/api/EntregaTurnoSeguridad';

function getXsrfToken(): string {
    const match = document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

async function leerJson(res: Response, mensajeDeError: string) {
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.message || mensajeDeError);
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

export async function guardarRelevo(form: Record<string, unknown>): Promise<{ message: string; data: DetalleRelevo }> {
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

export async function actualizarRelevo(id: number, form: Record<string, unknown>): Promise<{ message: string; data: DetalleRelevo }> {
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
