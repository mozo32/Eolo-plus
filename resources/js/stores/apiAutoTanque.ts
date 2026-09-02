function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

export async function fetchRemisionesDelDia(filtros: any) {
    const cleanParams = {
        ...filtros.params,
        page: filtros.page,
        per_page: filtros.per_page,
    };

    const queryParams = new URLSearchParams(cleanParams);

    const res = await fetch(
        `/api/Remision?${queryParams.toString()}`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
        },
    );

    const data = await res.json();

    if (!res.ok) {
        throw new Error(
            data?.message || 'Error al cargar remisiones',
        );
    }

    return data;
}

export async function guardarEntregarTurno(form: any) {
    const xsrf = getXsrfToken();
    const formData = new FormData();

    const appendValue = (
        key: string,
        value: any,
    ) => {
        if (
            value !== null &&
            value !== undefined &&
            value !== ''
        ) {
            formData.append(
                key,
                String(value),
            );
        }
    };

    appendValue('id', form.id);
    appendValue('nombre', form.nombre);
    appendValue('fecha', form.fecha);
    appendValue('cmIni', form.cmIni);
    appendValue('litrosIni', form.litrosIni);
    appendValue(
        'totalizadorIni',
        form.totalizadorIni,
    );

    appendValue(
        'nombreCierre',
        form.nombreCierre,
    );
    appendValue(
        'fechaCierre',
        form.fechaCierre,
    );
    appendValue(
        'cmCierre',
        form.cmCierre,
    );
    appendValue(
        'litrosCierre',
        form.litrosCierre,
    );
    appendValue(
        'totalizadorCierre',
        form.totalizadorCierre,
    );

    form.remisiones?.forEach(
        (remision: any, index: number) => {
            appendValue(
                `remisiones[${index}][id]`,
                remision.id,
            );

            appendValue(
                `remisiones[${index}][folio]`,
                remision.folio,
            );

            appendValue(
                `remisiones[${index}][litros]`,
                remision.litros,
            );

            appendValue(
                `remisiones[${index}][isCancelled]`,
                remision.isCancelled ? 1 : 0,
            );
        },
    );

    form.entradasASA?.forEach(
        (entrada: any, index: number) => {
            appendValue(
                `entradasASA[${index}][id]`,
                entrada.id,
            );

            appendValue(
                `entradasASA[${index}][litros]`,
                entrada.litros,
            );

            appendValue(
                `entradasASA[${index}][remision]`,
                entrada.remision,
            );

            appendValue(
                `entradasASA[${index}][tomaFisicaCm]`,
                entrada.tomaFisicaCm,
            );

            appendValue(
                `entradasASA[${index}][tomaFisicaLitros]`,
                entrada.tomaFisicaLitros,
            );

            entrada.evidencias?.forEach(
                (archivo: File) => {
                    formData.append(
                        `entradasASA[${index}][evidencias][]`,
                        archivo,
                        archivo.name,
                    );
                },
            );
        },
    );

    appendValue(
        'resumen[totalVendidos]',
        form.resumen?.totalVendidos,
    );

    appendValue(
        'resumen[totalSuman]',
        form.resumen?.totalSuman,
    );

    appendValue(
        'resumen[balanceAritmetico]',
        form.resumen?.balanceAritmetico,
    );

    appendValue(
        'resumen[balanceFisico]',
        form.resumen?.balanceFisico,
    );

    appendValue(
        'resumen[diferenciaFinal]',
        form.resumen?.diferenciaFinal,
    );

    const res = await fetch(
        '/api/TurnoAutoTanque',
        {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'X-XSRF-TOKEN': xsrf,
            },
            body: formData,
            credentials: 'same-origin',
        },
    );

    const data = await res
        .json()
        .catch(() => ({}));

    if (!res.ok) {
        throw new Error(
            data?.message ||
                data?.error ||
                'Error al guardar',
        );
    }

    return data;
}

export async function fetchTurnoActivo() {
    const res = await fetch(
        '/api/TurnoAutoTanque/check-active',
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
            credentials: 'same-origin',
        },
    );

    if (!res.ok) {
        return null;
    }

    return await res.json();
}

export async function fetchUltimoTotalizador() {
    const res = await fetch(
        '/api/TurnoAutoTanque/ultimo-totalizador',
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
            credentials: 'same-origin',
        },
    );

    if (!res.ok) {
        return {
            totalizador: 0,
        };
    }

    return await res.json();
}

export const cancelarRemisionAPI = async (
    folio: string,
) => {
    const xsrf = getXsrfToken();

    const response = await fetch(
        `/api/TurnoAutoTanque/remisiones/${folio}/cancelar`,
        {
            method: 'PUT',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': xsrf,
            },
            credentials: 'same-origin',
        },
    );

    if (!response.ok) {
        throw new Error(
            'Error al cancelar en servidor',
        );
    }

    return await response.json();
};

export async function fetchRemisionById(
    id: number | string,
) {
    const res = await fetch(
        `/api/Remision/${id}`,
        {
            headers: {
                Accept: 'application/json',
            },
            credentials: 'same-origin',
        },
    );

    const data = await res.json();

    if (!res.ok) {
        throw new Error(
            data?.message ||
                'Error al obtener la remisión',
        );
    }

    return data;
}

export async function updateRemision(
    id: number | string,
    form: any,
) {
    const xsrf = getXsrfToken();

    const res = await fetch(
        `/api/Remision/${id}`,
        {
            method: 'PUT',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': xsrf,
            },
            body: JSON.stringify(form),
            credentials: 'same-origin',
        },
    );

    const data = await res
        .json()
        .catch(() => ({}));

    if (!res.ok) {
        throw new Error(
            data?.message ||
                'Error al actualizar la remisión',
        );
    }

    return data;
}

export async function fetchAutotanque(
    params: {
        page?: number;
        per_page?: number;
        id?: string;
        responsable?: string;
        estado?: string;
        inspeccion?: string;
        diferencia?: string;
        start?: string;
        end?: string;
    },
) {
    const qs = new URLSearchParams(
        params as any,
    ).toString();

    const res = await fetch(
        `/api/TurnoAutoTanque?${qs}`,
        {
            headers: {
                Accept: 'application/json',
            },
            credentials: 'same-origin',
        },
    );

    const data = await res.json();

    if (!res.ok) {
        throw new Error(
            data?.message || 'Error al cargar',
        );
    }

    return data;
}

export async function showAutotanque(
    id: number,
) {
    const res = await fetch(
        `/api/TurnoAutoTanque/${id}`,
        {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        },
    );

    const data = await res
        .json()
        .catch(() => ({}));

    return {
        ok: res.ok,
        ...data,
    };
}

export async function eliminarTurno(
    id: number,
) {
    const res = await fetch(
        `/api/TurnoAutoTanque/eliminarTurno/${id}`,
        {
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        },
    );

    const data = await res
        .json()
        .catch(() => ({}));

    return {
        ok: res.ok,
        ...data,
    };
}

export async function excelAutoTanqueApi(
    filtros = {},
) {
    const params = new URLSearchParams(
        filtros,
    ).toString();

    const res = await fetch(
        `/api/TurnoAutoTanque/Excel?${params}`,
        {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
        },
    );

    const data = await res.json();

    if (!res.ok) {
        throw new Error(
            data?.message ||
                'Error al obtener registros',
        );
    }

    return data;
}
