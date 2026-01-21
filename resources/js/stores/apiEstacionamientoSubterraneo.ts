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
export async function actualizarEstaSubTerraneo(id: number, form: any) {
    await fetch("/sanctum/csrf-cookie", { credentials: "same-origin" });

    const xsrf = getXsrfToken();

    const res = await fetch(
        `/api/EstacionamientoSubTerraneo/${id}/salida`,
        {
            method: "PUT",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-XSRF-TOKEN": xsrf,
            },
            body: JSON.stringify(form),
            credentials: "same-origin",
        }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.message || "No se pudo actualizar");
    }

    return data;
}

export async function listarEstacionamientoSubTerraneo(
    params?: {
        search?: string;
        page?: number;
    }
): Promise<EstacionamientoResponse<EstacionamientoItem>> {

    const query = new URLSearchParams();

    if (params?.search) query.append("search", params.search);
    if (params?.page) query.append("page", params.page.toString());

    const res = await fetch(
        `/api/EstacionamientoSubTerraneo?${query.toString()}`,
        {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
            credentials: "same-origin",
        }
    );

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data?.message || "Error al obtener registros");
    }

    return data;
}
export async function fetchEstacionamientoDetalle(id: number) {
    console.log(id);

    const res = await fetch(`/api/EstacionamientoSubTerraneo/${id}`, {
        headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "No se pudo cargar el detalle");

    return data as EstacionamientoItem;
}
