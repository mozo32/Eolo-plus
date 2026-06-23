function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}
export async function guardarCheckListTurnoApi(form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch("/api/CheckListTurno", {
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
export async function fetchCheckListTurno(params: {
    page?: number;
    search?: string;
    per_page?: number;
}) {
    const qs = new URLSearchParams(params as any).toString();

    const res = await fetch(`/api/CheckListTurno?${qs}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message);

    return data;
}
export async function fetchShowCheckListTurno(id: number) {
    const res = await fetch(`/api/CheckListTurno/${id}`, {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "No se pudo cargar el detalle");
    return data;
}
export async function actualizarCheckListTurnoApi(id: number, form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/CheckListTurno/${id}`, {
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
export async function buscarUsuariosApi(query: string) {
    const res = await fetch(`/api/usuarios/buscar?q=${encodeURIComponent(query)}`, {
        headers: {
            Accept: "application/json",
        },
        credentials: "same-origin",
    });

    if (!res.ok) {
        throw new Error("Error al buscar usuarios");
    }

    return res.json();
}
export async function eliminar(id: number) {
    const res = await fetch(`/api/CheckListTurno/eliminar/${id}`, {
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

export async function fetchCheckListPendiente() {
    const res = await fetch(`/api/CheckListTurno/pendiente`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });
    if (!res.ok) return null;
    return await res.json();
}

export const fetchNotasOperacionales = async (): Promise<any> => {
    try {
        const res = await fetch(`/api/CheckListTurno/indexNotas`, {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "X-Requested-With": "XMLHttpRequest"
            },
            credentials: "same-origin",
        });
        if (!res.ok) {
            throw new Error(`Error en la petición: ${res.status}`);
        }
        return await res.json();

    } catch (error) {
        console.error("Error en fetchNotasOperacionales:", error);
        return { ok: false, data: [] };
    }
};

export const validarNotaOperacional = async (id: number): Promise<any> => {
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/CheckListTurno/validarnota/${id}`, {
        method: "PUT",
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': xsrf,
        },
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.message || "Error al actualizar Registro");
    }

    return data;
};

export async function validarCheckListTurnoApi(id: number, form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/CheckListTurno/aprobar/${id}`, {
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
export async function operaciones(fecha?: string) {
    const params = new URLSearchParams();

    if (fecha) {
        params.append("fecha", fecha);
    }

    const query = params.toString();

    const res = await fetch(`/api/CheckListTurno/TotalOperaciones${query ? `?${query}` : ""}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    if (!res.ok) {
        throw new Error("No se pudieron obtener las operaciones");
    }

    return await res.json();
}
