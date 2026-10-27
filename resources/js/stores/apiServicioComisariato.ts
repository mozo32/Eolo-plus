function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}
export async function guardarServicioComisariatoApi(form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch("/api/ServicioComisariato", {
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

export type ProveedorComisariato = { id: number; nombre: string };

/** La fila que devuelve el índice: `fact_servicio` es el proveedor elegido del catálogo; `catering` es el texto de las filas viejas. */
export type FilaServicioComisariato = {
    id: number;
    catering?: string | null;
    fact_servicio_id?: number | null;
    fact_servicio?: { id: number; nombre: string } | null;
    [campo: string]: any;
};

export async function obtenerProveedoresComisariato(): Promise<ProveedorComisariato[]> {
    const res = await fetch('/api/ServicioComisariato/proveedores', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
    });

    const data = await res.json().catch(() => []);

    if (!res.ok) {
        throw new Error('No se pudo cargar la lista de proveedores');
    }

    return data;
}

export async function fetchServicioComisariato(params: {
    page?: number;
    search?: string;
    per_page?: number;
    id?: string;
    fechaInicio?: string;
    fechaFin?: string;
    periodo?: string;
    proveedorId?: string;
    matricula?: string;
    forma_pago?: string;
}) {
    const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
    );

    const qs = new URLSearchParams(cleanParams as any).toString();

    const res = await fetch(`/api/ServicioComisariato?${qs}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data?.message || "Error al consultar servicio de comisariato");

    return data;
}
export async function fetchShowServicioComisariato(id: number) {
    const res = await fetch(`/api/ServicioComisariato/${id}`, {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "No se pudo cargar el detalle");
    return data;
}

export async function actualizarServicioComisariatoApi(id: number, form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/ServicioComisariato/${id}`, {
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
        throw new Error(data?.message || "Error al actualizar Registro");
    }

    return data;
}

export async function eliminar(id: number) {
    const res = await fetch(`/api/ServicioComisariato/eliminar/${id}`, {
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
