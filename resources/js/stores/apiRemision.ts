import Swal from "sweetalert2";

function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}


export async function ultimaLectura() {
    const res = await fetch("/api/Remision/ultimaLectura", {
        method: "GET",
        headers: { 'Accept': 'application/json' },
        credentials: "same-origin",
    });
    if (!res.ok) return [];
    return await res.json();
}

export async function obtenerResponsableHistoricosApi(matricula: string) {
    const res = await fetch(`/api/Remision/buscarResponsable/${encodeURIComponent(matricula)}`, {
        method: "GET",
        headers: { 'Accept': 'application/json' },
        credentials: "same-origin",
    });
    if (!res.ok) return [];
    return await res.json();
}
export async function excelRemisionesApi(filtros = {}) {
    const params = new URLSearchParams(filtros).toString();

    const res = await fetch(`/api/Remision/Excel?${params}`, {
        method: "GET",
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        credentials: "same-origin",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Error al obtener registros");
    return data;
}
