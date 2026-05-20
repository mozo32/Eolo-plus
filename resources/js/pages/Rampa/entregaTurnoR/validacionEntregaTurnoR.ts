// resources/js/pages/Rampa/entregaTurnoR/utils/validacionEntregaTurnoR.ts

export const getStepErrors = (
    step: number,
    formData: any,
    vehiculos: any,
    barrasRemolque: any,
    gpus: any,
    carritoGolf: any,
    aeronaves: any,
    firmas: any
): string[] => {
    const errors: string[] = [];

    switch (step) {
        case 1:
            if (!formData.encabezado.jefeTurno) errors.push("Nombre del Jefe de Turno");
            if (!formData.comunicaciones.radiosVHF || formData.comunicaciones.radiosVHF === "0") {
                errors.push("Cantidad de Radios VHF");
            }
            if (!formData.comunicaciones.radiosUHF || formData.comunicaciones.radiosUHF === "0") {
                errors.push("Frecuencia de Radio UHF");
            }
            break;

        case 2:
            Object.entries(vehiculos).forEach(([id, v]: [string, any]) => {
                if (v.estado == 'Operativo') {
                    if (!v.limpieza) errors.push(`Limpieza de ${id.toUpperCase()}`);
                    if (!v.llantas) errors.push(`Llantas de ${id.toUpperCase()}`);
                    if ('nivel' in v && !v.nivel) errors.push(`Nivel de ${id.toUpperCase()}`);
                    if ('frenos' in v && !v.frenos) errors.push(`Frenos de ${id.toUpperCase()}`);
                    if ('luces' in v && !v.luces) errors.push(`Luces de ${id.toUpperCase()}`);
                }
            });
            break;

        case 3:
            if (!barrasRemolque.total) errors.push("Cantidad de Barras de Remolque");
            if (!barrasRemolque.limpieza) errors.push("Limpieza de Barras de Remolque");
            if (!barrasRemolque.estado) errors.push("Estado físico de Barras de Remolque");
            if (!barrasRemolque.cabezales) errors.push("Cantidad de Cabezales");
            if (!barrasRemolque.cabezalesEstado) errors.push("Estado de Cabezales");
            if (!barrasRemolque.escalerasCantidad) errors.push("Cantidad de Escaleras");
            if (!barrasRemolque.escalerasEstado) errors.push("Estado de Escaleras");
            if (!barrasRemolque.hamburgueseraLimpieza) errors.push("Limpieza de Hamburguesera");
            if (!barrasRemolque.hamburgueseraLlantas) errors.push("Llantas de Hamburguesera");

            Object.entries(gpus).forEach(([id, g]: [string, any]) => {
                if (!g.limpia) errors.push(`Limpieza de ${id.toUpperCase()}`);
                if (!g.enchufe) errors.push(`Estado del Enchufe de ${id.toUpperCase()}`);
                if (!g.llantas) errors.push(`Estado de las llantas de ${id.toUpperCase()}`);
                if (id === 'gpu115') {
                    if (!g.horometro) errors.push(`Horómetro de ${id.toUpperCase()}`);
                    if (!g.cableado) errors.push(`Estado del cableado de ${id.toUpperCase()}`);
                } else if (id === 'hobart600' || id === 'foxtronics') {
                    if (!g.numPlantas) errors.push(`Número de plantas de ${id.toUpperCase()}`);
                }
            });
            break;

        case 4:
            if (!aeronaves.hangar1) errors.push("Número de aeronaves del hangar 1");
            if (!aeronaves.hangar2) errors.push("Número de aeronaves del hangar 2");
            if (!aeronaves.plataforma_h1) errors.push("Número de aeronaves de la plataforma del hangar 1");
            if (!aeronaves.plataforma_h2) errors.push("Número de aeronaves de la plataforma del hangar 2");

            Object.entries(carritoGolf).forEach(([id, g]: [string, any]) => {
                if(g.estado == 'Operativo'){
                    if (!g.limpieza) errors.push(`Limpieza de ${id.toUpperCase()}`);
                    if (!g.carga) errors.push(`Carga del carrito de ${id.toUpperCase()}`);
                    if (!g.llantas) errors.push(`Estado de las llantas del carrito ${id.toUpperCase()}`);
                    if (!g.luces) errors.push(`Estado de las luces del carrito ${id.toUpperCase()}`);
                    if (!g.frenos) errors.push(`Estado de los frenos del carrito ${id.toUpperCase()}`);
                }

            });

            if (!firmas.entrega.nombre) errors.push("Nombre de quien Entrega");
            break;
    }

    return errors;
};
