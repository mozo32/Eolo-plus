function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}
export async function guardarOperacionesDiariasApi(form: any) {
    const xsrf = getXsrfToken();

    const url = form.id ? `/api/OperacionesDiarias/${form.id}` : "/api/OperacionesDiarias";
    const method = form.id ? "PUT" : "POST";

    const res = await fetch(url, {
        method: method,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': xsrf,
        },
        body: JSON.stringify(form),
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "Error en el servidor");
    return data;
}
export async function fetchOperacionesDiarias(params: {
    fecha?: Date | string;
}) {
    const xsrf = getXsrfToken();

    const query = new URLSearchParams();

    if (params.fecha) {
        const fecha =
            params.fecha instanceof Date
                ? params.fecha.toISOString().split("T")[0]
                : params.fecha;

        query.append("fecha", fecha);
    }

    const res = await fetch(
        `/api/OperacionesDiarias${query.toString() ? `?${query}` : ""}`,
        {
            method: "GET",
            headers: {
                Accept: "application/json",
                "X-XSRF-TOKEN": xsrf,
            },
            credentials: "same-origin",
        }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.message || "Error al obtener operaciones diarias");
    }

    return data;
}

export async function obtenerOperacionesDiariasApi(filtros = {}) {
    const params = new URLSearchParams(filtros).toString();

    const res = await fetch(`/api/OperacionesDiarias?${params}`, {
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
export async function excelOperacionesDiariasApi(filtros = {}) {
    const params = new URLSearchParams(filtros).toString();

    const res = await fetch(`/api/OperacionesDiarias/Excel?${params}`, {
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

export async function autocompleteMatriculaApi(query: string) {
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/OperacionesDiarias/autocomplete?q=${encodeURIComponent(query)}`, {
        method: "GET",
        headers: {
            Accept: 'application/json',
            'X-XSRF-TOKEN': xsrf,
        },
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error("Error en autocompletado");
    return data;
}

export async function obtenerInfoMatriculaApi(matricula: string) {
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/OperacionesDiarias/buscar/${encodeURIComponent(matricula)}`, {
        method: "GET",
        headers: {
            Accept: 'application/json',
            'X-XSRF-TOKEN': xsrf,
        },
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error("Error al buscar información de matrícula");
    return data;
}
export async function verificarOperacionExistenteApi(matricula: string, fecha: string, tipo: string, modulo: string) {
    const res = await fetch(`/api/OperacionesDiarias/verificar?matricula=${matricula}&fecha=${fecha}&tipo=${tipo}&modulo=${modulo}`, {
        method: "GET",
        headers: { 'Accept': 'application/json' },
        credentials: "same-origin",
    });
    return await res.json();
}
export async function obtenerNombresHistoricosApi(matricula: string) {
    const res = await fetch(`/api/OperacionesDiarias/nombres/${encodeURIComponent(matricula)}`, {
        method: "GET",
        headers: { 'Accept': 'application/json' },
        credentials: "same-origin",
    });
    if (!res.ok) return [];
    return await res.json();
}
export async function obtenerPendientesApi(modulo: string) {
    const res = await fetch(
        `/api/OperacionesDiarias/pendientes?modulo=${encodeURIComponent(modulo)}`, {
            method: "GET",
            headers: { 'Accept': 'application/json' },
            credentials: "same-origin",
        }
    );

    const data = await res.json().catch(() => []);

    if (!res.ok) {
        throw new Error(data?.message || "Error al obtener las matrículas pendientes");
    }

    return data;
}
