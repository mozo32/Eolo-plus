
export type EntregarTurnoRow = {
    id: number;
    fecha: string;
    nombre: string;
    nombre_jefe_turno_despacho: string;
    nombre_quien_entrega: string;
};
export type ChecklistComunicacionItem = {
    entregado: boolean;
    cargado: "si" | "no";
};

export type ChecklistComunicacion = {
    items: Record<string, ChecklistComunicacionItem>;
    fallas?: string | null;
};

export type EquipoOficinaItem = {
    equipo: string;
    existencia: number;
    entregadas: number;
    recibidas: number;
};
export type Copiadoras = {
    funciona: "si" | "no";
    toner: string;
    paquetes: number;
    fallas?: string | null;
};

export type FondoDocumentacion = {
    fondoRecibido: number;
    cantidadValesGasolina: number;
    fondoEntregado: number;
    folioValesGasolina: number;
    reporteAterisaje: "si" | "no";
    cantidadReporteAterisaje: number;
    totalLlegadaOperacion: number;
    totalSalidaOperacion: number;
    reportesEnviadosCorreo: string;
    cantidadOperacionesCordinadasEntregadas: number;
    cuantosWalkArounds: number;
};
export type EntregaTurnoDetalle = EntregarTurnoRow & {
    fecha?: string | null;
    nombre?: string | null;

    nombre_jefe_turno_despacho: string | null;
    nombre_quien_entrega: string | null;

    checklist_comunicacion: ChecklistComunicacion | null;
    equipo_oficina: EquipoOficinaItem[] | null;

    copiadoras: Copiadoras | null;
    fondo_documentacion: FondoDocumentacion | null;

    estado_caja_fuerte: string | null;

    created_at?: string;
    updated_at?: string;
};
function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}
export async function guardarEntregarTurnoApi(form: any) {
    const xsrf = getXsrfToken();
    const res = await fetch("/api/EntregarTurno", {
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
export async function fetchEntregarTurno(params: any = {}) {
    const qs = new URLSearchParams(params);

    const res = await fetch(`/api/EntregarTurno?${qs.toString()}`, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message);
    return data;
}
export async function fetchEntregaTurnoDetalle(id: number) {
    const res = await fetch(`/api/EntregarTurno/${id}`, {
        headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "No se pudo cargar el detalle");

    return data as EntregaTurnoDetalle;
}
export async function deleteEntregraTurno(id: number) {
    await fetch("/sanctum/csrf-cookie", { credentials: "same-origin" });
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/EntregarTurno/${id}`, {
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
export async function actualizarEntregarTurnoApi(id: number, form: any) {

    await fetch("/sanctum/csrf-cookie", { credentials: "same-origin" });
    const xsrf = getXsrfToken();
    const res = await fetch(`/api/EntregarTurno/${id}`, {
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
