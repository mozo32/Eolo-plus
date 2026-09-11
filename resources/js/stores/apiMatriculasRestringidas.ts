import type { MatriculaRestringida } from '@/pages/despacho/operacionesProgramadas/types';

function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

const BASE = '/api/MatriculasRestringidas';

async function pedir(url: string, init: RequestInit = {}) {
    const res = await fetch(url, {
        ...init,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': getXsrfToken(),
            ...(init.headers || {}),
        },
        credentials: 'same-origin',
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.message || 'Error en el servidor');
    }

    return data;
}

export async function obtenerMatriculasRestringidasApi(): Promise<MatriculaRestringida[]> {
    return pedir(BASE, { method: 'GET' });
}

export async function agregarMatriculaRestringidaApi(
    matricula: string,
): Promise<{ message: string; restriccion: MatriculaRestringida }> {
    return pedir(BASE, {
        method: 'POST',
        body: JSON.stringify({ matricula }),
    });
}

/**
 * Cambia un solo switch: lo que no viaja, el backend no lo toca.
 */
export async function actualizarMatriculaRestringidaApi(
    matricula: string,
    cambios: { llegada?: boolean; salida?: boolean },
): Promise<{ message: string; restriccion: MatriculaRestringida }> {
    return pedir(`${BASE}/${encodeURIComponent(matricula)}`, {
        method: 'PUT',
        body: JSON.stringify(cambios),
    });
}

export async function eliminarMatriculaRestringidaApi(matricula: string): Promise<{ message: string }> {
    return pedir(`${BASE}/${encodeURIComponent(matricula)}`, { method: 'DELETE' });
}
