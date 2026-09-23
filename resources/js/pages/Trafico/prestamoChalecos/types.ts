import type { PeriodoFiltro } from '@/components/ModalPeriodo';

/**
 * Tipos del módulo "Préstamo de chalecos" (Tráfico): lo que envía el formulario
 * y lo que devuelve el API.
 */

export type UsuarioTrafico = {
    id: number;
    nombre: string;
};

export type PrestamoChalecoForm = {
    /** AAAA-MM-DD, fecha local de México. */
    fecha: string;
    nombre_recibe: string;
    /** Id del usuario de Tráfico que entrega; null mientras no se elige. */
    usuario_entrega_id: number | null;
    /** El archivo se conserva solo en memoria; nunca se convierte a texto. */
    foto_ine: File | null;
};

export type ErroresPrestamoChaleco = Partial<Record<keyof PrestamoChalecoForm, string>>;

export const NOMBRE_MAX = 120;

export const FOTO_TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const FOTO_ACCEPT = FOTO_TIPOS_PERMITIDOS.join(',');
export const FOTO_TAMANO_MAXIMO_MB = 5;

/** Devuelve el mensaje de error, o null si el archivo es una imagen aceptable. */
export const validarArchivoFoto = (archivo: File): string | null => {
    if (!(FOTO_TIPOS_PERMITIDOS as readonly string[]).includes(archivo.type)) {
        return 'Solo se permiten imágenes JPG, PNG o WEBP.';
    }

    if (archivo.size > FOTO_TAMANO_MAXIMO_MB * 1024 * 1024) {
        return `La imagen no debe pesar más de ${FOTO_TAMANO_MAXIMO_MB} MB.`;
    }

    return null;
};

/** 1234567 → "1.2 MB"; 45000 → "44 KB". */
export const formatearTamano = (bytes: number): string => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${bytes} B`;
};

// ---------------------------------------------------------------------------
// Registros (API)
// ---------------------------------------------------------------------------

export type EstadoPrestamoChaleco = 'prestado' | 'devuelto';

/** Usuario relacionado tal como lo devuelve el API. */
export interface UsuarioRelacionado {
    id: number;
    name: string;
}

export type PrestamoChaleco = {
    id: number;
    /** AAAA-MM-DD del préstamo. */
    fecha: string;
    nombre_recibe: string;
    usuario_entrega_id: number;
    entregado_por: UsuarioRelacionado | null;
    devuelto_por: UsuarioRelacionado | null;
    /** Id de la imagen; la foto se pide al endpoint protegido, nunca por URL pública. */
    foto_ine_imagen_id: number | null;
    estado: EstadoPrestamoChaleco;
    /** Fecha y hora de la devolución, o null mientras esté prestado. */
    fecha_devolucion: string | null;
    created_at?: string;
};

export type FiltrosPrestamos = {
    nombre: string;
    estado: '' | EstadoPrestamoChaleco;
    /** Solo organiza la interfaz: al backend viajan las fechas resueltas. */
    periodo: PeriodoFiltro;
    fecha_inicio: string;
    fecha_fin: string;
};

export const FILTROS_PRESTAMOS_VACIOS: FiltrosPrestamos = {
    nombre: '',
    estado: '',
    periodo: 'dia',
    fecha_inicio: '',
    fecha_fin: '',
};

export const POR_PAGINA_OPCIONES = [10, 20, 50] as const;

/** Fecha y hora local de México como "AAAA-MM-DD HH:mm", sin pasar por UTC. */
export const fechaHoraAhora = (): string => {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(new Date());

    const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find(p => p.type === tipo)?.value ?? '';
    // Algunos motores devuelven "24" a medianoche con hour12:false.
    const hora = valor('hour') === '24' ? '00' : valor('hour');

    return `${valor('year')}-${valor('month')}-${valor('day')} ${hora}:${valor('minute')}`;
};

/** "AAAA-MM-DD" → "DD/MM/AAAA" sin usar Date (evita corrimientos de zona). */
export const formatearFecha = (fecha: string): string => {
    const [a, m, d] = fecha.slice(0, 10).split('-');
    return a && m && d ? `${d}/${m}/${a}` : fecha;
};

/** "AAAA-MM-DD HH:mm" → "DD/MM/AAAA HH:mm". */
export const formatearFechaHora = (valor: string): string => {
    const [fecha, hora = ''] = valor.split(' ');
    return `${formatearFecha(fecha)}${hora ? ` ${hora}` : ''}`;
};

/** Texto del botón de fechas; "Todas las fechas" mientras no se elija ninguna. */
export const etiquetaPeriodo = (filtros: FiltrosPrestamos): string => {
    if (!filtros.fecha_inicio && !filtros.fecha_fin) return 'Todas las fechas';
    if (filtros.periodo === 'dia') return formatearFecha(filtros.fecha_inicio);
    if (filtros.periodo === 'rango') return `${formatearFecha(filtros.fecha_inicio)} / ${formatearFecha(filtros.fecha_fin)}`;
    if (filtros.periodo === 'mes') return filtros.fecha_inicio.substring(0, 7);

    return filtros.fecha_inicio.substring(0, 4);
};
