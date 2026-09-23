import type {
    EntregaPayload,
    FiltrosHistorico,
    MetaPaginacion,
    Prestamo,
    PrestamoPayload,
} from '@/pages/Rampa/relacionPlanta/types';

function getXsrfToken(): string {
    const match = document.cookie.split('; ').find(row => row.startsWith('XSRF-TOKEN='));
    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

const BASE = '/api/RelacionPlanta';

/** Error de la API con el código HTTP y el código de negocio del backend. */
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

async function pedir<T>(url: string, init: RequestInit = {}): Promise<T> {
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
        throw new ErrorApi(data?.message || 'Error en el servidor', res.status, data?.codigo ?? null, data?.errors ?? {});
    }

    return data as T;
}

/** Préstamo abierto (o null) y el último horómetro final registrado. */
export async function obtenerPrestamoActualApi(): Promise<{ prestamo: Prestamo | null; ultimoHorometroFin: string | null }> {
    const data = await pedir<{ prestamo: Prestamo | null; ultimo_horometro_fin: string | null }>(`${BASE}/actual`, {
        method: 'GET',
    });

    return { prestamo: data.prestamo, ultimoHorometroFin: data.ultimo_horometro_fin ?? null };
}

export function prestarGpuApi(payload: PrestamoPayload): Promise<{ message: string; prestamo: Prestamo }> {
    return pedir(`${BASE}/prestar`, { method: 'POST', body: JSON.stringify(payload) });
}

export function finalizarPrestamoApi(id: number, payload: EntregaPayload): Promise<{ message: string; prestamo: Prestamo }> {
    return pedir(`${BASE}/${id}/finalizar`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export type PaginaHistorico = MetaPaginacion & { data: Prestamo[] };

export function obtenerHistoricoPlantaApi(filtros: FiltrosHistorico, pagina: number, porPagina: number): Promise<PaginaHistorico> {
    const params = new URLSearchParams({ page: String(pagina), per_page: String(porPagina) });

    // `periodo` solo organiza la interfaz: al backend viajan las fechas resueltas.
    (['fecha_inicio', 'fecha_fin', 'empresa', 'matricula'] as const).forEach(clave => {
        if (filtros[clave]) params.set(clave, filtros[clave]);
    });

    return pedir(`${BASE}/historico?${params.toString()}`, { method: 'GET' });
}

export function obtenerEmpresasPlantaApi(q = ''): Promise<string[]> {
    const sufijo = q ? `?q=${encodeURIComponent(q)}` : '';
    return pedir(`${BASE}/empresas${sufijo}`, { method: 'GET' });
}
