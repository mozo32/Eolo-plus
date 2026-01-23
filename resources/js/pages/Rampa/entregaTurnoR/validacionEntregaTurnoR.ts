const labels: any = {
    encabezado: {
        fecha: "Fecha del turno",
        jefeTurno: "Jefe de turno",
    },
    comunicaciones: {
        radios: "Número de radios",
        radioFrecuencia: "Radiofrecuencia",
    },
    vehiculos: {
        limpieza: "Limpieza",
        nivel: "Nivel",
        llantas: "Llantas",
        frenos: "Frenos",
        obs: "Observaciones",
    },
    barrasRemolque: {
        total: "Número total de barras",
        limpieza: "Limpieza de barras",
        estado: "Estado de barras",
        cabezales: "Total de cabezales",
        cabezalesEstado: "Estado de cabezales",
        escalerasCantidad: "Cantidad de escaleras",
        escalerasEstado: "Estado de escaleras",
        hamburgueseraLimpieza: "Limpieza de hamburguesera",
        hamburgueseraLlantas: "Llantas de hamburguesera",
    },
    gpus: {
        total: "Total de GPU",
        limpias: "GPU limpias",
        voltaje: "Voltaje general",
        enchufe: "Enchufe",
        llantas: "Llantas",
    },
    gpusDetalle: {
        limpia: "Limpieza",
        voltaje: "Voltaje",
        numero: "Número de GPU",
        enchufe: "Enchufe",
        llantas: "Llantas",
    },
    carritoGolf: {
        limpieza: "Limpieza",
        carga: "Nivel de carga",
        llantas: "Llantas",
        luces: "Luces",
        frenos: "Frenos",
        obs: "Observaciones",
    },
    aeronaves: {
        total: "Total de aeronaves",
        h1: "Aeronaves en H1",
        h2: "Aeronaves en H2",
    },
};

type ResultadoValidacion = {
    ok: boolean;
    message?: string;
    faltantes?: string[];
};

export function validarStep(step: number, form: any): ResultadoValidacion {
    switch (step) {
        case 1:
            return validarEncabezado(form);
        case 2:
            return validarVehiculos(form);
        case 3:
            return validarBarrasYGpus(form);
        case 4:
            return validarCarritoGolf(form);
        case 5:
            return validarAeronavesYFirmas(form);
        default:
            return { ok: true };
    }
}

/* ================= STEP 1 ================= */
function validarEncabezado(form: any): ResultadoValidacion {
    const faltantes: string[] = [];

    for (const campo in form.encabezado) {
        if (!form.encabezado[campo]) {
            faltantes.push(labels.encabezado[campo]);
        }
    }

    for (const campo in form.comunicaciones) {
        if (campo !== "radiosFuncionando" && !form.comunicaciones[campo]) {
            faltantes.push(labels.comunicaciones[campo]);
        }
    }

    return faltantes.length
        ? {
            ok: false,
            message: "Faltan campos por completar",
            faltantes,
        }
        : { ok: true };
}


/* ================= STEP 2 ================= */
function validarVehiculos(form: any): ResultadoValidacion {
    const faltantes: string[] = [];

    for (const unidad in form.vehiculos) {
        const vehiculo = form.vehiculos[unidad];

        for (const campo in vehiculo) {
            if (campo === "obs") continue;

            if (!vehiculo[campo]) {
                faltantes.push(
                    `Vehículo ${unidad.toUpperCase()} – ${labels.vehiculos[campo]}`
                );
            }
        }
    }

    return faltantes.length
        ? {
            ok: false,
            message: "Faltan campos en vehículos",
            faltantes,
        }
        : { ok: true };
}


/* ================= STEP 3 ================= */
function validarBarrasYGpus(form: any): ResultadoValidacion {
    const faltantes: string[] = [];

    for (const campo in form.barrasRemolque) {
        if (!form.barrasRemolque[campo]) {
            faltantes.push(
                `Barras de remolque – ${labels.barrasRemolque[campo]}`
            );
        }
    }

    for (const campo in form.gpus) {
        if (campo !== "detalle" && !form.gpus[campo]) {
            faltantes.push(`GPU – ${labels.gpus[campo]}`);
        }
    }

    for (const gpuKey in form.gpus.detalle) {
        const gpu = form.gpus.detalle[gpuKey];

        for (const campo in gpu) {
            if (campo === "obs") continue;

            if (!gpu[campo]) {
                faltantes.push(
                    `${gpuKey.toUpperCase()} – ${labels.gpusDetalle[campo]}`
                );
            }
        }
    }

    return faltantes.length
        ? {
            ok: false,
            message: "Faltan campos en Barras de Remolque y GPU's",
            faltantes,
        }
        : { ok: true };
}


/* ================= STEP 4 ================= */
function validarCarritoGolf(form: any): ResultadoValidacion {
    const faltantes: string[] = [];

    for (const id in form.carritoGolf) {
        const carrito = form.carritoGolf[id];

        for (const campo in carrito) {
            if (campo === "obs") continue;

            if (!carrito[campo]) {
                faltantes.push(
                    `Carrito ${id} – ${labels.carritoGolf[campo]}`
                );
            }
        }
    }

    return faltantes.length
        ? {
            ok: false,
            message: "Faltan campos en Carrito de Golf",
            faltantes,
        }
        : { ok: true };
}


/* ================= STEP 5 ================= */
function validarAeronavesYFirmas(form: any): ResultadoValidacion {
    const faltantes: string[] = [];

    for (const campo in form.aeronaves) {
        if (!form.aeronaves[campo]) {
            faltantes.push(labels.aeronaves[campo]);
        }
    }

    return faltantes.length
        ? {
            ok: false,
            message: "Faltan campos en Aeronaves",
            faltantes,
        }
        : { ok: true };
}

