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

const toNumber = (value: string | number) => {
    return Number(String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, "")) || 0;
};

const horaValida24 = (hora: string) => {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(hora);
};

export function validarServicioComisariato(form: ServicioComisariatoForm) {
    const errores: string[] = [];

    const subtotal = toNumber(form.subtotal);
    const total = toNumber(form.total);

    if (!form.catering.trim()) errores.push("Catering es obligatorio");
    if (!form.formaPago.trim()) errores.push("Forma de pago es obligatoria");
    if (!form.fechaEntrega) errores.push("Fecha de entrega es obligatoria");
    if (!form.horaEntrega) errores.push("Hora de entrega es obligatoria");
    if (form.horaEntrega && !horaValida24(form.horaEntrega)) errores.push("Hora de entrega inválida, use formato 24 horas HH:MM");
    if (!form.matricula.trim()) errores.push("Matrícula es obligatoria");
    if (!form.detalle.trim()) errores.push("Detalle del servicio es obligatorio");
    if (!form.solicitadoPor.trim()) errores.push("Solicitado por es obligatorio");
    if (!form.atendio.trim()) errores.push("Atendió es obligatorio");

    if (form.subtotal === "" || subtotal < 0) {
        errores.push("Subtotal inválido");
    }

    if (form.total === "" || total < 0) {
        errores.push("Total inválido");
    }

    if (
        form.subtotal !== "" &&
        form.total !== "" &&
        total < subtotal
    ) {
        errores.push("El total no puede ser menor al subtotal");
    }

    return {
        valid: errores.length === 0,
        errores,
    };
}
