function getXsrfToken(): string {
    const match = document.cookie
        .split("; ")
        .find((row) => row.startsWith("XSRF-TOKEN="));

    return match
        ? decodeURIComponent(match.split("=")[1])
        : "";
}


export type PernoctaRegistroDetalle = {
    id: number;
    fecha: string;
    hora: string;
    matricula: string;
    ubicacion: string;
    observaciones?: string | null;
    nombre: string;
    aeronave?: string | null;
    tipo_cliente?: string | null;
    categoria?: string | null;
};
export type PernoctaRegistro = {
    id: string;
    fecha: string;
    hora: string;
    total: number;
    registros: PernoctaRegistroDetalle[];
};
export type PernoctaFiltros = {
    matricula?: string;
    ubicacion?: string;
    responsable?: string;
    fechaInicio?: string;
    fechaFin?: string;
    periodo?: string;
    page?: number;
    per_page?: number;
};

export type PernoctaPaginationMeta = {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
};

export type PernoctaPaginationResponse = {
    data: PernoctaRegistro[];
    meta: PernoctaPaginationMeta;
};

export async function obtenerPernoctasApi(
    filtros: PernoctaFiltros = {},
    signal?: AbortSignal,
): Promise<PernoctaPaginationResponse> {
    const params = new URLSearchParams();

    Object.entries(filtros).forEach(([key, value]) => {
        if (
            value !== undefined &&
            value !== null &&
            value !== ""
        ) {
            params.append(key, String(value));
        }
    });

    const response = await fetch(
        `/api/PernoctaDia?${params.toString()}`,
        {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
            credentials: "same-origin",
            signal,
        },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data?.message ||
                "No se pudieron consultar las pernoctas",
        );
    }

    return data;
}
export type AeronaveFueraHangar = {
    matricula: string;
    motivo: string;
    ultima_operacion?: string | null;
    fecha_hora_ultima_operacion?: string | null;
};

export type ErrorGuardarPernocta = Error & {
    status?: number;
    data?: {
        message?: string;
        codigo?: string;
        aeronaves_fuera_hangar?: AeronaveFueraHangar[];
        errors?: Record<string, string[]>;
    };
};
export async function guardarPernoctaDiaApi(
    form: any,
) {
    const xsrf = getXsrfToken();

    const response = await fetch(
        "/api/PernoctaDia",
        {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-Requested-With":
                    "XMLHttpRequest",
                "X-XSRF-TOKEN": xsrf,
            },
            body: JSON.stringify(form),
            credentials: "same-origin",
        },
    );

    const data = await response
        .json()
        .catch(() => ({}));

    if (!response.ok) {
        const error = new Error(
            data?.message ||
                "Error al guardar la pernocta del día",
        ) as ErrorGuardarPernocta;

        error.status = response.status;
        error.data = data;

        throw error;
    }

    return data;
}


