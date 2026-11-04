import type { RangoPeriodo } from '@/components/ModalPeriodo';

/** Los ocho apartados que se contestan con una casilla. */
export const CASILLAS = [
    'aviones_csae',
    'combustible',
    'resguardo_vehicular',
    'estacionamiento',
    'posiciones',
    'vehiculos',
    'operaciones',
    'visitantes',
] as const;

export type Casilla = (typeof CASILLAS)[number];

/** Lo que se lee en pantalla de cada apartado. */
export const ETIQUETA_CASILLA: Record<Casilla, string> = {
    aviones_csae: 'Aviones de CSAE',
    combustible: 'Combustible',
    resguardo_vehicular: 'Resguardo vehicular',
    estacionamiento: 'Estacionamiento',
    posiciones: 'Posiciones',
    vehiculos: 'Vehículos',
    operaciones: 'Operaciones',
    visitantes: 'Visitantes',
};

export const SECCIONES = ['frente', 'atras'] as const;

export type Seccion = (typeof SECCIONES)[number];

export const ETIQUETA_SECCION: Record<Seccion, string> = {
    frente: 'Frente',
    atras: 'Atrás',
};

/**
 * La pernocta mensual lleva tres estados, no dos: la entrega de turno es
 * diaria y la pernocta es mensual, así que «no marcado» no significa que
 * se haya dejado de hacer.
 */
export const PERNOCTA = ['S', 'N', 'R'] as const;

export type Pernocta = (typeof PERNOCTA)[number];

export const ETIQUETA_PERNOCTA: Record<Pernocta, string> = {
    S: 'Hecho',
    N: 'No hecho',
    R: 'Sin revisar',
};

export type SeccionRelevo = {
    id: number;
    nombre: string;
    hora: string;
    firmado_fbo: boolean;
    pernocta_mensual: Pernocta;
    extras: number;
};

export type FilaRelevo = {
    fecha: string;
    frente: SeccionRelevo | null;
    atras: SeccionRelevo | null;
};

/**
 * Los dos roles del pivote de firmas, como los escribe el servidor en
 * `EntregaTurnoSeguridad::ROL_QUIEN_ENTREGA` y `::ROL_FBO`.
 *
 * Están aquí para que las pantallas no repitan el literal: `tsc` no atrapa un
 * renombre del lado servidor, así que un literal suelto en un componente
 * seguiría compilando y dejaría de encontrar la firma en silencio. La prueba
 * de contrato del detalle vigila los dos valores.
 */
export const ROL_QUIEN_ENTREGA = 'quien_entrega';

export const ROL_FBO = 'fbo';

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
    seccion: Seccion;
    pernocta_mensual: Pernocta;
    observaciones: string | null;
    firmas: FirmaRelevo[];
} & Record<Casilla, boolean>;

export type PendienteRelevo = {
    id: number;
    nombre: string;
    fecha: string;
    hora: string;
    seccion: Seccion;
};

/**
 * Lo que el formulario manda al editar: todo opcional, porque el `PUT`
 * acepta cambios parciales.
 */
export type PayloadRelevo = Partial<Record<Casilla, boolean>> & {
    fecha_hora?: string;
    seccion?: Seccion;
    pernocta_mensual?: Pernocta;
    observaciones?: string | null;
    firma_quien_entrega?: string;
    firma_fbo?: string;
};

/** Lo que manda al CREAR, donde tres campos son obligatorios. */
export type PayloadRelevoNuevo = PayloadRelevo & {
    fecha_hora: string;
    seccion: Seccion;
    firma_quien_entrega: string;
};

export type FiltrosRelevo = {
    page?: number;
    per_page?: number;
    search?: string;
    seccion?: '' | Seccion;
    fecha_inicio?: string;
    fecha_fin?: string;
    estado?: '' | 'falta_fbo' | 'completas';
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
