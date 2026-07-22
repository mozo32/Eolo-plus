export type PernoctaExcelRegistro = {
    id: number;
    fecha: string;
    hora: string;
    matricula: string;
    aeronave: string | null;
    estatus: string | null;
    ubicacion: string;
    categoria: string | null;
    nombre: string | null;
    observaciones: string | null;
};

export type PernoctaExcelFiltros = {
    desde?: string;
    hasta?: string;
    matricula?: string;
    ubicacion?: string;
    responsable?: string;
};

type PernoctaExcelResponse = {
    data: PernoctaExcelRegistro[];
    total: number;
};

export async function obtenerPernoctasExcelApi(
    filtros: PernoctaExcelFiltros,
): Promise<PernoctaExcelResponse> {
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
        `/api/PernoctaMes?${params.toString()}`,
        {
            method: "GET",
            headers: {
                Accept: "application/json",
            },
            credentials: "same-origin",
        },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            data?.message ||
                "No se pudieron consultar las pernoctas",
        );
    }

    return {
        data: Array.isArray(data?.data)
            ? data.data
            : [],
        total: Number(data?.total || 0),
    };
}
