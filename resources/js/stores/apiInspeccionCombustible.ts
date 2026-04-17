//apiInspeccionCombustible.ts
function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}
interface FotoData {
    file: string;
    observacion: string;
    alertaRosa: boolean;
}
export async function apiValidarColor(base64Data: string, tipoInspeccion: string) {
    const xsrf = getXsrfToken();
    const response = await fetch('/api/InspeccionAutoTanque/validar-color', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': xsrf,
        },
        body: JSON.stringify({
            image: base64Data,
            tipo: tipoInspeccion
        })
    });
    const data = await response.json();
    return data;
};

export async function apiGuardarInspeccionCompleta(datos: { shell: FotoData[], hydrokit: FotoData[] }) {
    const xsrf = getXsrfToken();
    const response = await fetch('/api/InspeccionAutoTanque/guardar-inspeccion', {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': xsrf,
        },
        body: JSON.stringify(datos)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al guardar la inspección completa');
    }

    return await response.json();
}

export async function indexCombustible(params: {
    page?: number;
    per_page?: number;
    type?: string;
    start?: string;
    end?: string;
    id?: string | number;
    inspector?: string;
}) {
    const cleanParams = Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== null && v !== '')
    );

    const qs = new URLSearchParams(cleanParams as any).toString();
    const res = await fetch(`/api/InspeccionAutoTanque/index-inspeccion?${qs}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });
    return await res.json();
}
export async function fetchInspeccionId(id: number | string) {
    const res = await fetch(`/api/InspeccionAutoTanque/show-inspeccion/${id}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || 'Error al obtener la remisión');

    return data;
}
export async function apiAprenderColor(h: number, tipo: string) {
    const response = await fetch('/api/InspeccionAutoTanque/aprender-color', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getXsrfToken() },
        body: JSON.stringify({ h, tipo })
    });
    return await response.json();
}

export async function apiEliminar(id: number) {
    const res = await fetch(`/api/InspeccionAutoTanque/eliminar/${id}`, {
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
