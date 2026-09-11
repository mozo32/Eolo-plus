export type TipoOperacion = 'llegada' | 'salida';

export type ModuloConsumidor = 'operaciones_diarias' | 'walkaround';

export type TabProgramadas = 'ambas' | 'salidas' | 'llegadas';

/** Restricción de movimientos de una matrícula. */
export interface MatriculaRestringida {
    matricula: string;
    /** true = la llegada está restringida. */
    llegada: boolean;
    /** true = la salida está restringida. */
    salida: boolean;
}

/** Usuario tal como lo comparte HandleInertiaRequests. */
export interface UsuarioAutenticado {
    isAdmin?: boolean;
    departamentos?: {
        subdepartamentos?: { route?: string }[];
    }[];
}

/**
 * ¿Puede administrar Operaciones Programadas? Admin, o quien tenga el
 * subdepartamento operacionesProgramadas. Es el mismo criterio que aplica el
 * middleware subdep en el backend.
 */
export const puedeAdministrarProgramadas = (usuario?: UsuarioAutenticado | null): boolean => {
    if (!usuario) return false;
    if (usuario.isAdmin) return true;

    return (usuario.departamentos ?? []).some(departamento =>
        (departamento.subdepartamentos ?? []).some(sub =>
            sub.route?.endsWith('operacionesprogramadas'),
        ),
    );
};

/** Operación programada tal como la devuelve el backend. */
export interface OperacionProgramada {
    id: number;
    fecha: string;
    tipo: TipoOperacion;
    matricula: string;
    equipo: string;
    hora: string;
    lugar: string | null;
    pax: number | null;
    /** Texto libre y opcional del plan de vuelo. Solo aplica a salidas. */
    fp: string | null;
    observaciones: string | null;
    status: string;
    modulos_usados: ModuloConsumidor[];
}

/** Cuerpo que espera la API al crear o actualizar. */
export interface OperacionProgramadaPayload {
    fecha: string;
    tipo: TipoOperacion;
    matricula: string;
    equipo: string;
    hora: string;
    lugar: string | null;
    pax: number | null;
    fp: string | null;
    observaciones: string | null;
}

/** Estado del formulario del modal: todo string para los inputs controlados. */
export interface OperacionProgramadaForm {
    id: number | null;
    fecha: string;
    tipo: TipoOperacion;
    matricula: string;
    equipo: string;
    hora: string;
    lugar: string;
    pax: string;
    fp: string;
    observaciones: string;
}

/**
 * Fecha de hoy con la zona horaria del proyecto, en formato YYYY-MM-DD.
 * Se usa Intl y no toISOString para no caer en el día anterior o siguiente
 * por la conversión a UTC.
 */
export const fechaHoy = (): string =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());

/** Hora local actual del proyecto en formato HH:mm. */
export const horaAhora = (): string =>
    new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date());

/** Formato obligatorio de hora en 24 horas. */
export const REGEX_HORA_24 = /^([01]\d|2[0-3]):[0-5]\d$/;

export const horaValida = (hora: string): boolean => REGEX_HORA_24.test(hora);

/**
 * True cuando la operación es de hoy y su hora todavía no llega.
 * La comparación se hace con la fecha y hora locales, nunca en UTC.
 */
export const esHoraFutura = (fecha: string, hora: string): boolean => {
    if (fecha !== fechaHoy()) return false;
    if (!horaValida(hora)) return false;

    return hora > horaAhora();
};

export const formularioVacio = (fecha: string): OperacionProgramadaForm => ({
    id: null,
    fecha,
    tipo: 'salida',
    matricula: '',
    equipo: '',
    hora: '',
    lugar: '',
    pax: '',
    fp: '',
    observaciones: '',
});

export const formularioDesde = (operacion: OperacionProgramada): OperacionProgramadaForm => ({
    id: operacion.id,
    fecha: operacion.fecha,
    tipo: operacion.tipo,
    matricula: operacion.matricula,
    equipo: operacion.equipo,
    hora: operacion.hora,
    lugar: operacion.lugar ?? '',
    pax: operacion.pax === null ? '' : String(operacion.pax),
    fp: operacion.fp ?? '',
    observaciones: operacion.observaciones ?? '',
});

export const formularioAPayload = (
    form: OperacionProgramadaForm,
): OperacionProgramadaPayload & { id: number | null } => ({
    id: form.id,
    fecha: form.fecha,
    tipo: form.tipo,
    matricula: form.matricula.trim().toUpperCase(),
    equipo: form.equipo.trim().toUpperCase(),
    hora: form.hora,
    lugar: form.lugar.trim() === '' ? null : form.lugar.trim().toUpperCase(),
    pax: form.pax === '' ? null : Number(form.pax),
    // FP solo aplica a salidas y se guarda como null cuando queda vacío.
    // fp_folio no viaja: está oculto y su valor histórico se conserva en la BD.
    fp: form.tipo === 'salida' && form.fp.trim() !== '' ? form.fp.trim() : null,
    observaciones: form.observaciones.trim() === '' ? null : form.observaciones.trim(),
});

/**
 * Precarga que una operación programada entrega a Operaciones Diarias o a
 * WalkAround. Se pasa como objeto tipado para no repartir diez props sueltas
 * entre componentes.
 */
export interface PrecargaProgramada {
    operacionProgramadaId: number;
    tipo: TipoOperacion;
    /** Etiqueta que usa Operaciones Diarias. */
    movimiento: 'Llegada' | 'Salida';
    /** Etiqueta que usa WalkAround para el mismo concepto. */
    movimientoWalkAround: 'Entrada' | 'Salida';
    matricula: string;
    equipo: string;
    fecha: string;
    hora: string;
    lugar: string;
    pax: number | null;
    fp: string;
    observaciones: string;
}

export const precargaDesde = (operacion: OperacionProgramada): PrecargaProgramada => ({
    operacionProgramadaId: operacion.id,
    tipo: operacion.tipo,
    movimiento: operacion.tipo === 'llegada' ? 'Llegada' : 'Salida',
    movimientoWalkAround: operacion.tipo === 'llegada' ? 'Entrada' : 'Salida',
    matricula: operacion.matricula,
    equipo: operacion.equipo,
    fecha: operacion.fecha,
    hora: operacion.hora,
    lugar: operacion.lugar ?? '',
    pax: operacion.pax,
    fp: operacion.fp ?? '',
    observaciones: operacion.observaciones ?? '',
});
