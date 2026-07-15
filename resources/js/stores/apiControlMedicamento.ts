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
export async function habilitarMedicamento(id: number) {
    const xsrf = getXsrfToken();

    const res = await fetch(
        `/api/ControlMedicamento/medicamento/habilitar/${id}`,
        {
            method: 'PUT',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': xsrf,
            },
            credentials: 'same-origin',
        }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(
            data?.message || 'No se pudo habilitar el medicamento'
        );
    }

    return data;
}
export async function fetchMedicamentosDeshabilitados() {
    const res = await fetch(
        '/api/ControlMedicamento/medicamentos/deshabilitados',
        {
            headers: {
                Accept: 'application/json',
            },
            credentials: 'same-origin',
        }
    );

    const data = await res.json().catch(() => []);

    if (!res.ok) {
        throw new Error(
            data?.message ||
                'No se pudieron cargar los medicamentos deshabilitados'
        );
    }

    return Array.isArray(data) ? data : [];
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
interface MovimientosParams {
    periodo?: string;
    tipo?: string;
    fecha?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    mes?: string;
    anio?: string;
    page?: number;
    per_page?: number;
}

export async function movimientos(
    params: MovimientosParams = {}
) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([clave, valor]) => {
        if (
            valor !== undefined &&
            valor !== null &&
            valor !== ''
        ) {
            searchParams.append(clave, String(valor));
        }
    });

    const query = searchParams.toString();

    const res = await fetch(
        `/api/ControlMedicamento/ultimosMovimientos${
            query ? `?${query}` : ''
        }`,
        {
            headers: {
                Accept: 'application/json',
            },
            credentials: 'same-origin',
        }
    );

    const data = await res.json();

    if (!res.ok) {
        throw new Error(
            data?.message ??
                data?.error ??
                'No se pudieron cargar los movimientos.'
        );
    }

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

export async function exportarCierresMedicamentoPdf(params: {
    fecha_inicio: string;
    fecha_fin: string;
}) {
    const qs = new URLSearchParams();

    qs.append('fecha_inicio', params.fecha_inicio);
    qs.append('fecha_fin', params.fecha_fin);

    const res = await fetch(`/api/ControlMedicamento/exportar-pdf?${qs.toString()}`, {
        method: 'GET',
        headers: {
            Accept: 'application/pdf',
        },
        credentials: 'same-origin',
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Error al exportar PDF');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `cierres_medicamento_${params.fecha_inicio}_${params.fecha_fin}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
}
