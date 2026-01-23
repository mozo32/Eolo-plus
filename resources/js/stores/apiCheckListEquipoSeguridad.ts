function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}
export async function guardarCheckListEquipoSeguridadApi(form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch("/api/ChecklistEquipoSeguridad", {
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

export async function fetchCheckUser(id: number) {
    const res = await fetch(`/api/ChecklistEquipoSeguridad/${id}`, {
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
