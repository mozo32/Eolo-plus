function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}
export async function fetchMedicamentos(params: any = {}) {
    const qs = new URLSearchParams(params);

    const res = await fetch(`/api/ControlMedicamento/medicamentos`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message);
    return data;
}
export async function guardarControlMedicamentoApi(form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch("/api/ControlMedicamento", {
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
export async function actualizarControlMedicamentoApi(id: number, form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/ControlMedicamento/${id}`, {
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

export async function guardarEntregaMedicamentoApi(form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch("/api/ControlMedicamento/entregaMedicamento", {
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
export async function revastecimientoMedicamentos(id: number, form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/ControlMedicamento/medicamento/${id}`, {
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
        throw new Error(data?.message || "Error al reavastecer el medicamento");
    }

    return data;
}
export async function movimientos() {
    const res = await fetch(`/api/ControlMedicamento/ultimosMovimientos`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message);
    return data;
}
