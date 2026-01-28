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
