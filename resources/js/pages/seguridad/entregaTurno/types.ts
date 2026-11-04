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

export type FirmaRelevo = {
    id: number;
    rol: string;
    tag: string | null;
    orden: number;
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

/** La hora de ahora en 24 horas, como `HH:mm`. */
export const horaAhora = (): string => {
    const ahora = new Date();

    return `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
};
