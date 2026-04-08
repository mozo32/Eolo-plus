import Swal from "sweetalert2";

function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

export async function obtenerHora(matricula: string) {
    const res = await fetch(`/api/Remision/matricula/${encodeURIComponent(matricula)}`, {
        method: "GET",
        headers: { 'Accept': 'application/json' },
        credentials: "same-origin",
    });
    if (!res.ok) return [];
    return await res.json();
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
