function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

export async function guardarRegistroVisitantes(form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch("/api/RegistroVisitantes", {
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
export async function listaRegistroVisitantes(search = '', date = '') {
    const params = new URLSearchParams({
        search: search,
        fecha: date
    });

    const res = await fetch(`/api/RegistroVisitantes?${params.toString()}`, {
        method: "GET",
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        credentials: "same-origin",
    });

    if (!res.ok) throw new Error("Error al obtener los registros");
    return await res.json();
}
export async function guardarSalida(id: number, form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/RegistroVisitantes/${id}`, {
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
