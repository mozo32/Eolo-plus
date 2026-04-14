function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}
export async function guardarInspeccion(form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch("/api/InspeccionAutoTanque", {
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


export async function fetchInspeccionPorTurno(id: any) {
    const res = await fetch(`/api/InspeccionAutoTanque/turno/${id}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Error al obtener los datos');

    return data;
}
