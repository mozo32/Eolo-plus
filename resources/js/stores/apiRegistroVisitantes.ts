function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find((row) => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

export interface RegistroVisitantesFiltros {
    search?: string;
    fecha?: string;
    fechaInicio?: string;
    fechaFin?: string;
    page?: number;
    per_page?: number;
}

export interface MetaPaginacion {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export interface RespuestaPaginada<T> extends MetaPaginacion {
    data: T[];
    first_page_url?: string;
    last_page_url?: string;
    next_page_url?: string | null;
    prev_page_url?: string | null;
}

export async function guardarRegistroVisitantes(form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch('/api/RegistroVisitantes', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': xsrf,
        },
        body: JSON.stringify(form),
        credentials: 'same-origin',
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.message || 'Error al guardar Registro');
    }

    return data;
}

export async function listaRegistroVisitantes<T = any>(
    filtros: RegistroVisitantesFiltros = {},
): Promise<RespuestaPaginada<T>> {
    const search = filtros.search?.trim() ?? '';
    const fechaInicio =
        filtros.fechaInicio || filtros.fecha || '';
    const fechaFin =
        filtros.fechaFin || filtros.fecha || '';
    const page = filtros.page ?? 1;
    const perPage = filtros.per_page ?? 10;

    const params = new URLSearchParams();

    if (search) {
        params.set('search', search);
    }

    if (fechaInicio) {
        params.set('fechaInicio', fechaInicio);
    }

    if (fechaFin) {
        params.set('fechaFin', fechaFin);
    }

    params.set('page', String(page));
    params.set('per_page', String(perPage));

    const res = await fetch(
        `/api/RegistroVisitantes?${params.toString()}`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
        },
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(
            data?.message ||
                'Error al obtener los registros',
        );
    }

    return data as RespuestaPaginada<T>;
}

export async function guardarSalida(id: number, form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/RegistroVisitantes/${id}`, {
        method: 'PUT',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': xsrf,
        },
        body: JSON.stringify(form),
        credentials: 'same-origin',
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.message || 'Error al Guardar Salida');
    }

    return data;
}

export interface RespuestaVisitantesPendientes<T> {
    data: T[];
    total: number;
}

export async function listaVisitantesPendientes<T = any>(): Promise<
    RespuestaVisitantesPendientes<T>
> {
    const res = await fetch(
        '/api/RegistroVisitantes/pendientes',
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
            credentials: 'same-origin',
        },
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(
            data?.message ||
                'No se pudieron consultar los visitantes pendientes',
        );
    }

    return {
        data: Array.isArray(data?.data)
            ? data.data
            : [],
        total: Number(data?.total) || 0,
    };
}
