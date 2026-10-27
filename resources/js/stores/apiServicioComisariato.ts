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

/**
 * Por qué la lista de proveedores puede venir vacía: no hay ninguno configurado en el catálogo
 * (hay que crearlos) o los hay pero están todos de baja (hay que reactivar uno).
 */
export type EstadoProveedoresComisariato = 'disponibles' | 'todos-de-baja' | 'sin-configurar';

export async function obtenerProveedoresComisariatoConEstado(): Promise<{
    lista: ProveedorComisariato[];
    estado: EstadoProveedoresComisariato;
}> {
    const res = await fetch('/api/ServicioComisariato/proveedores', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
    });

    const data = await res.json().catch(() => null);

    // Una respuesta sin la forma esperada es un error, no una lista vacía: leerla como "no hay
    // ninguno" sería justo el diagnóstico falso que el estado existe para evitar.
    if (!res.ok || !Array.isArray(data?.proveedores) || typeof data?.estado !== 'string') {
        throw new Error('No se pudo cargar la lista de proveedores');
    }

    return { lista: data.proveedores, estado: data.estado };
}

export async function obtenerProveedoresComisariato(): Promise<ProveedorComisariato[]> {
    return (await obtenerProveedoresComisariatoConEstado()).lista;
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
