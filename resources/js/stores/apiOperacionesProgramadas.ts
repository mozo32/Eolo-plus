import type {
    ModuloConsumidor,
    OperacionProgramada,
    OperacionProgramadaPayload,
    TipoOperacion,
} from '@/pages/despacho/operacionesProgramadas/types';

function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

const BASE = '/api/OperacionesProgramadas';

/**
 * Error de la API que conserva el código devuelto por el backend, para que la
 * pantalla pueda distinguir un rechazo de negocio de un fallo cualquiera.
 */
export class ErrorApi extends Error {
    constructor(
        message: string,
        public codigo: string | null = null,
    ) {
        super(message);
        this.name = 'ErrorApi';
    }
}

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
        throw new ErrorApi(data?.message || 'Error en el servidor', data?.codigo ?? null);
    }

    return data;
}

export type ListadoProgramadas = {
    fecha: string;
    salidas: OperacionProgramada[];
    llegadas: OperacionProgramada[];
};

export async function obtenerOperacionesProgramadasApi(fecha: string): Promise<ListadoProgramadas> {
    return pedir(`${BASE}?fecha=${encodeURIComponent(fecha)}`, { method: 'GET' });
}

export async function guardarOperacionProgramadaApi(
    form: OperacionProgramadaPayload & { id?: number | null },
): Promise<{ message: string; operacion: OperacionProgramada }> {
    const url = form.id ? `${BASE}/${form.id}` : BASE;

    return pedir(url, {
        method: form.id ? 'PUT' : 'POST',
        body: JSON.stringify(form),
    });
}

export async function eliminarOperacionProgramadaApi(id: number): Promise<{ message: string }> {
    return pedir(`${BASE}/${id}`, { method: 'DELETE' });
}

/**
 * Operaciones programadas que el módulo indicado todavía no ha utilizado.
 * El estado es independiente por módulo.
 */
export async function obtenerProgramadasPendientesApi(params: {
    modulo: ModuloConsumidor;
    fecha?: string;
    tipo?: TipoOperacion;
}): Promise<OperacionProgramada[]> {
    const query = new URLSearchParams({ modulo: params.modulo });

    if (params.fecha) query.append('fecha', params.fecha);
    if (params.tipo) query.append('tipo', params.tipo);

    return pedir(`${BASE}/pendientes?${query.toString()}`, { method: 'GET' });
}

/**
 * Vista previa del movimiento: adelanta si la matrícula lo tiene restringido.
 * La validación definitiva la hace el backend al guardar.
 */
export async function validarMovimientoProgramadoApi(params: {
    matricula: string;
    tipo: TipoOperacion;
    fecha: string;
    hora: string;
    id?: number | null;
}): Promise<{
    restriccion: { restringido: boolean; message: string | null };
}> {
    return pedir(`${BASE}/validar-movimiento`, {
        method: 'POST',
        body: JSON.stringify(params),
    });
}
