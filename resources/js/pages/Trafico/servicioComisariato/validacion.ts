type ServicioComisariatoForm = {
    catering: string;
    formaPago: string;
    fechaEntrega: string;
    horaEntrega: string;
    matricula: string;
    detalle: string;
    solicitadoPor: string;
    atendio: string;
    subtotal: string | number;
    total: string | number;
};

export function validarServicioComisariato(form: ServicioComisariatoForm) {
    const errores: string[] = [];

    if (!form.catering.trim()) errores.push("Catering es obligatorio");
    if (!form.formaPago.trim()) errores.push("Forma de pago es obligatoria");
    if (!form.fechaEntrega) errores.push("Fecha de entrega es obligatoria");
    if (!form.horaEntrega) errores.push("Hora de entrega es obligatoria");
    if (!form.matricula.trim()) errores.push("Matrícula es obligatoria");
    if (!form.detalle.trim()) errores.push("Detalle del servicio es obligatorio");
    if (!form.solicitadoPor.trim()) errores.push("Solicitado por es obligatorio");
    if (!form.atendio.trim()) errores.push("Atendió es obligatorio");

    if (form.subtotal === "" || Number(form.subtotal) < 0) {
        errores.push("Subtotal inválido");
    }

    if (form.total === "" || Number(form.total) < 0) {
        errores.push("Total inválido");
    }

    if (
        form.subtotal !== "" &&
        form.total !== "" &&
        Number(form.total) > Number(form.subtotal)
    ) {
        errores.push("El total no puede ser mayor al subtotal");
    }

    return {
        valid: errores.length === 0,
        errores,
    };
}
