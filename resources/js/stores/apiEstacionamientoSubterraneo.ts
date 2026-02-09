function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}
type EstacionamientoResponse<T> = {
    data: T[];
    links: {
        first: string;
        last: string;
        prev: string | null;
        next: string | null;
    };
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
};

export type EstacionamientoItem = {
    id: number;
    vehiculo: string;
    color?: string;
    placas: string;
    matricula?: string;
    responsable: string;
    fecha_ingreso: string;
    fecha_salida?: string | null;
    oficial: string;
};
export async function guardarEstaSubTerraneo(form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch("/api/EstacionamientoSubTerraneo", {
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
        throw new Error(data?.message || "Error al guardar registro");
    }

    return data;
}

export async function listarEstaSubTerraneo(mes = '', anio = ''): Promise<{ data: any[] }> {
    const params = new URLSearchParams();
    if (mes) params.append('mes', mes);
    if (anio) params.append('anio', anio);

    const res = await fetch(`/api/EstacionamientoSubTerraneo?${params.toString()}`, {
        method: "GET",
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        credentials: "same-origin",
    });

    if (!res.ok) throw new Error("Error al obtener los registros");
    return await res.json();
}
export const obtenerDetalleVehiculo = async (fecha: string) => {
    const response = await fetch(`/api/EstacionamientoSubTerraneo/detalle/${fecha}`, {
        method: "GET",
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        credentials: "same-origin",
    });

    if (!response.ok) {
        throw new Error('Error en la petición');
    }

    return await response.json();
};
