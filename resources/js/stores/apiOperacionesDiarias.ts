function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}
export async function guardarOperacionesDiariasApi(form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch("/api/OperacionesDiarias", {
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
