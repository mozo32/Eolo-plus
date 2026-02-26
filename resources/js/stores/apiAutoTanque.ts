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
