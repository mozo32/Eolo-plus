function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}
export async function fetchRemisionesDelDia(fecha: string) {
    const params = new URLSearchParams({ fecha: fecha || '' });

    const res = await fetch(`/api/Remision?${params.toString()}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Error al cargar remisiones');

    return data;
}
export async function guardarEntregarTurno(form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch("/api/TurnoAutoTanque", {
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
        throw new Error(data?.message || "Error al guardar");
    }

    return data;
}
export async function fetchTurnoActivo() {
    const res = await fetch("/api/TurnoAutoTanque/check-active", {
        method: "GET",
        headers: { Accept: 'application/json' },
        credentials: "same-origin",
    });
    if (!res.ok) return null;
    return await res.json();
}
export async function fetchUltimoTotalizador() {
    const res = await fetch("/api/TurnoAutoTanque/ultimo-totalizador", {
        method: "GET",
        headers: { Accept: 'application/json' },
        credentials: "same-origin",
    });
    if (!res.ok) return { totalizador: 0 };
    return await res.json();
}
export const cancelarRemisionAPI = async (folio: string) => {
    const xsrf = getXsrfToken();
    const response = await fetch(`/api/TurnoAutoTanque/remisiones/${folio}/cancelar`, {
        method: 'PUT',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': xsrf,
        },
    });
    if (!response.ok) throw new Error('Error al cancelar en servidor');
    return await response.json();
};
export async function fetchRemisionById(id: number | string) {
    const res = await fetch(`/api/Remision/${id}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Error al obtener la remisión');

    return data;
}

export async function updateRemision(id: number | string, form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/Remision/${id}`, {
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
        throw new Error(data?.message || "Error al actualizar la remisión");
    }

    return data;
}
export async function fetchAutotanque(
    params: {
        page?: number;
        date?: string;
        search?: string;
        per_page?: number;
    }
) {
    const qs = new URLSearchParams(params as any).toString();

    const res = await fetch(`/api/TurnoAutoTanque?${qs}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Error al cargar');

    return data;
}
export async function showAutotanque(id: number) {
    const res = await fetch(`/api/TurnoAutoTanque/${id}`, {
        headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));

    return {
        ok: res.ok,
        ...data,
    };
}
export async function eliminarTurno(id: number) {
    const res = await fetch(`/api/TurnoAutoTanque/eliminarTurno/${id}`, {
        headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));

    return {
        ok: res.ok,
        ...data,
    };
}
