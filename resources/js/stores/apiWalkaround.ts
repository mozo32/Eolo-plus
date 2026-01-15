function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

export async function guardarWalkAroundApi(form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch("/api/walkarounds", {
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
        throw new Error(data?.message || "Error al guardar WalkAround");
    }

    return data;
}
export type WalkAroundRow = {
    id: number;
    fecha: string;
    movimiento: "entrada" | "salida";
    matricula: string;
    tipo: "avion" | "helicoptero";
    tipoAeronave: string | null;
    hora?: string | null;
    destino?: string | null;
    procedensia?: string | null;
};

export type WalkAroundDetalle = WalkAroundRow & {
    observaciones?: string | null;
    elabora?: string | null;
    elabora_personal_id: number | null;
    elabora_departamento_id: number | null;
    responsable?: string | null;
    jefe_area?: string | null;
    fbo?: string | null;

    // opcional si tu backend lo regresa así:
    checklists?: {
        checklist_avion?: Record<string, string>;
        checklist_helicoptero?: Record<string, string>;
    };
    numero_estaticas?: number | null;

    marcas_danio?: Array<{ x: number; y: number;z: number; descripcion?: string | null; severidad?: string | null }>;
    imagenes?: Array<{ id: number; url: string; tag?: string | null; orden?: number; status?: string | null; }>;
    firmas?: Array<{ id: number; url: string; tag?: string; rol?: string | null; orden?: number; status?: string | null; }>;
};
export type WalkAroundBitacora = {
    id: number;
    fecha: string;
    hora?: string | null;
    modulo: string;
    accion: string | null;
    descripcion?: string | null;
    usuario_id?: number | null;
    elabora?: string | null;
};
export async function fetchWalkarounds(params: any = {}) {
    const qs = new URLSearchParams(params);

    const res = await fetch(`/api/walkarounds?${qs.toString()}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message);
    return data;
}

export async function fetchWalkaroundDetalle(id: number) {

    const res = await fetch(`/api/walkarounds/${id}`, {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "No se pudo cargar el detalle");
    return data as WalkAroundDetalle;
}

export async function deleteWalkaround(id: number) {
    // si usas sanctum/sesión:
    await fetch("/sanctum/csrf-cookie", { credentials: "same-origin" });
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/walkarounds/${id}`, {
        method: "DELETE",
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': xsrf,
        },
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "No se pudo eliminar");
    return data;
}
export async function updateWalkaroundApi(id: number, form: any) {

    await fetch("/sanctum/csrf-cookie", { credentials: "same-origin" });
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/walkarounds/${id}`, {
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
    if (!res.ok) throw new Error(data?.message || "No se pudo actualizar");
    return data;
}
export async function fetchWalkaroundBitacora(): Promise<WalkAroundBitacora[]> {
    const res = await fetch("/api/walkarounds/bitacora", {
        headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        credentials: "same-origin",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "No se pudo cargar la bitácora");

    return data.data;
}
export async function updateFirmaWalkaroundApi(id: number, form: any) {

    await fetch("/sanctum/csrf-cookie", { credentials: "same-origin" });
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/walkarounds/firma/${id}`, {
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
    if (!res.ok) throw new Error(data?.message || "No se pudo actualizar");
    return data;
}
