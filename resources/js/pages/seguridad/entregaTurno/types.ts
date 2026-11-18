import type { RangoPeriodo } from '@/components/ModalPeriodo';

/** Un renglón del resumen del día, con su texto ya armado por el servidor. */
export type RenglonResumen = {
    clave: string;
    titulo: string;
    texto: string;
    entradas?: number;
    salidas?: number;
    total?: number;
};

export type ResumenRelevo = {
    /** El relevo está cerrado y sus cifras ya no cambian. */
    congelado: boolean;
    renglones: RenglonResumen[];
};

/** Un renglón de la tabla: un relevo. */
export type FilaRelevo = {
    id: number;
    fecha: string;
    hora: string;
    nombre: string;
    /** Los roles de cierre que faltan. Vacío quiere decir cerrado. */
    firmas_faltantes: string[];
    /** Aeronaves que pernoctaron ese día: congelada si el relevo lo está. */
    pernocta: number;
};

/**
 * Los tres roles del pivote de firmas, como los escribe el servidor en
 * `EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA`, `::ROL_JEFE_AREA` y `::ROL_FBO`.
 *
 * Están aquí para que las pantallas no repitan el literal: `tsc` no atrapa un
 * renombre del lado servidor, así que un literal suelto en un componente
 * seguiría compilando y dejaría de encontrar la firma en silencio. La prueba
 * de contrato del detalle vigila los valores.
 */
export const ROL_QUIEN_ENTREGA = 'quien_entrega';

export const ROL_FBO = 'fbo';

export const ROL_JEFE_AREA = 'jefe_area';

export const ETIQUETA_ROL: Record<string, string> = {
    quien_entrega: 'Quien entrega',
    jefe_area: 'Jefe de área',
    fbo: 'FBO',
};

export type FirmaRelevo = {
    id: number;
    rol: string;
    tag: string | null;
    url: string;
};

export type DetalleRelevo = {
    id: number;
    nombre: string;
    fecha: string;
    hora: string;
    fecha_hora: string;
    resumen: ResumenRelevo;
    observaciones: string | null;
    firmas: FirmaRelevo[];
};

export type PendienteRelevo = {
    id: number;
    nombre: string;
    fecha: string;
    hora: string;
    /** Lo que a QUIEN PREGUNTA le falta firmar de ese relevo. */
    falta: string[];
};

/**
 * Lo que el formulario manda al editar: todo opcional, porque el `PUT`
 * acepta cambios parciales.
 */
export type PayloadRelevo = {
    fecha_hora?: string;
    observaciones?: string | null;
    firma_quien_entrega?: string;
    firma_jefe_area?: string;
    firma_fbo?: string;
};

/** Lo que manda al CREAR, donde dos campos son obligatorios. */
export type PayloadRelevoNuevo = PayloadRelevo & {
    fecha_hora: string;
    firma_quien_entrega: string;
};

export type FiltrosRelevo = {
    page?: number;
    per_page?: number;
    search?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    estado?: '' | 'falta_jefe_area' | 'falta_fbo' | 'completas';
};

/** `dd/mm/aaaa` a partir de `aaaa-mm-dd`, sin pasar por Date. */
export const formatearFecha = (fecha: string): string => {
    const [anio, mes, dia] = fecha.split('-');

    return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha;
};

/**
 * La hora de ahora en 24 horas, como `HH:mm`, en hora de México.
 *
 * La zona va EXPLÍCITA y no se usa `new Date().getHours()`, que lee el reloj
 * del equipo. El formulario toma la fecha de `fechaHoy()`, que es el día del
 * SERVIDOR; en un equipo fuera de la zona de México un reloj local daría un
 * par fecha+hora que no corresponde a ningún instante real, y cerca de
 * medianoche caería del lado equivocado del día.
 *
 * Es copia literal de `pages/despacho/operacionesProgramadas/types.ts`, que
 * ya lo resolvía así. Copiar es la exención; reimplementarlo distinto no lo
 * era.
 */
export const horaAhora = (): string =>
    new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(new Date());

/** Lo que el botón de fechas dice cuando está cerrado. */
export const etiquetaPeriodo = (rango: RangoPeriodo): string => {
    if (!rango.fecha_inicio && !rango.fecha_fin) return 'Todas las fechas';
    if (rango.periodo === 'dia') return formatearFecha(rango.fecha_inicio);
    if (rango.periodo === 'rango') {
        return `${formatearFecha(rango.fecha_inicio)} / ${formatearFecha(rango.fecha_fin)}`;
    }
    if (rango.periodo === 'mes') return rango.fecha_inicio.substring(0, 7);

    return rango.fecha_inicio.substring(0, 4);
};
