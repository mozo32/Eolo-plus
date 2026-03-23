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
