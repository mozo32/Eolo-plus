function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}
export async function guardarMovimientoCSAEApi(form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch("/api/MovimientosCSAE", {
        method: "POST",
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': xsrf,
        },
        body: JSON.stringify(form),
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.message || "Error al guardar Registro");
    }

    return data;
}
export async function fetchMovimientoCSAE(params: {
    page?: number;
    search?: string;
    per_page?: number;
}) {
    const qs = new URLSearchParams(params as any).toString();

    const res = await fetch(`/api/MovimientosCSAE?${qs}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message);

    return data;
}
export async function fetchShowMovimientoCSAE(id: number) {
    const res = await fetch(`/api/MovimientosCSAE/${id}`, {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "No se pudo cargar el detalle");
    return data;
}
export async function guardarMovimientoCSASalida(id: number, form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/MovimientosCSAE/${id}`, {
        method: "PUT",
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': xsrf,
        },
        body: JSON.stringify(form),
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.message || "Error al Guardar Salida");
    }

    return data;
}
export async function eliminar(id: number) {
    const res = await fetch(`/api/MovimientosCSAE/eliminar/${id}`, {
        headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));

    return {
        ok: res.ok,
        status: res.status,
        ...data,
    };
}


export type AeronavePendienteCSAE = {
    id: number;
    matricula: string;
    tipo_aeronave: string;
    como_llega?: string | null;
    transportista?: string | null;
    observaciones_entrada?: string | null;
    fecha_hora_entrada: string;
    fecha_entrada: string;
    hora_entrada: string;
    minutos_en_csae: number;
    tiempo_en_csae: string;
    estado: string;
    ya_salio: boolean;
};

export type AeronavesPendientesResponse = {
    total: number;
    aeronaves: AeronavePendienteCSAE[];
};

export async function fetchAeronavesPendientesCSAE(
    search = '',
): Promise<AeronavesPendientesResponse> {
    const params = new URLSearchParams();

    if (search.trim()) {
        params.append('search', search.trim());
    }

    const query = params.toString();

    const res = await fetch(
        `/api/MovimientosCSAE/pendientes-salida${query ? `?${query}` : ''}`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        },
    );

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        throw new Error(
            data?.message ||
            'No se pudieron obtener las aeronaves pendientes',
        );
    }

    return data;
}
