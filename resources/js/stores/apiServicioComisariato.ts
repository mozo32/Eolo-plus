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

export async function fetchServicioComisariato(params: {
    page?: number;
    search?: string;
    per_page?: number;
    id?: string;
    fechaInicio?: string;
    fechaFin?: string;
    periodo?: string;
    catering?: string;
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

export type EvidenciaComisariato = {
    id: number;
    url: string;
    orden: number;
};

export async function subirEvidenciaComisariato(servicioId: number, foto: string): Promise<EvidenciaComisariato> {
    const res = await fetch(`/api/ServicioComisariato/${servicioId}/evidencias`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-XSRF-TOKEN": getXsrfToken(),
        },
        body: JSON.stringify({ foto }),
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.message || "No se pudo guardar la evidencia");
    }

    return data.data;
}

export async function eliminarEvidenciaComisariato(servicioId: number, imagenId: number): Promise<void> {
    const res = await fetch(`/api/ServicioComisariato/${servicioId}/evidencias/${imagenId}`, {
        method: "DELETE",
        headers: {
            Accept: "application/json",
            "X-XSRF-TOKEN": getXsrfToken(),
        },
        credentials: "same-origin",
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || "No se pudo eliminar la evidencia");
    }
}
