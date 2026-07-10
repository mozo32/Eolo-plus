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
export async function deshabilitarMedicamento(id: number) {
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/ControlMedicamento/medicamento/deshabilitar/${id}`, {
        method: "PUT",
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': xsrf,
        },
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(data?.message || "Error al Deshabilitar el medicamento");
    }

    return data;
}
export async function agregarMedicamento(data: {
    nombre: string;
    stockInicial: number;
}) {
    const xsrf = getXsrfToken();

    const res = await fetch(`/api/ControlMedicamento/medicamento/agregar`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-XSRF-TOKEN": xsrf,
        },
        credentials: "same-origin",
        body: JSON.stringify(data),
    });

    const response = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(response?.message || "Error al agregar el medicamento");
    }

    return response;
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

export async function fetchCierresMedicamento(params: any = {}) {
    const qs = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            qs.append(key, String(value));
        }
    });

    const url = qs.toString()
        ? `/api/ControlMedicamento/index?${qs.toString()}`
        : `/api/ControlMedicamento/index`;

    const res = await fetch(url, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => []);

    if (!res.ok) {
        throw new Error(data?.message || "Error al cargar cierres de turno");
    }

    return data;
}
