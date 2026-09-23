import type { PeriodoFiltro } from '@/components/ModalPeriodo';
import type { UsuarioAutenticado } from '@/pages/despacho/operacionesProgramadas/types';

export const EQUIPO_GPU = 'GPU N.115';

export type EstadoPrestamo = 'en_uso' | 'finalizado';

/** Un préstamo de la GPU tal como lo devuelve la API (decimales como texto). */
export interface Prestamo {
    id: number;
    equipo: string;
    fecha: string;
    empresa: string;
    matricula: string;
    horometro_inicio: string;
    horometro_fin: string | null;
    tiempo: string | null;
    status: EstadoPrestamo;
    created_at?: string;
    updated_at?: string;
}

export interface PrestamoPayload {
    fecha: string;
    empresa: string;
    matricula: string;
    horometro_inicio: number;
}

export interface EntregaPayload {
    horometro_fin: number;
    /** null: que lo calcule el backend (fin − inicio). */
    tiempo: number | null;
}

export interface FiltrosHistorico {
    /** Solo organiza la interfaz: al backend viajan las fechas ya resueltas. */
    periodo: PeriodoFiltro;
    fecha_inicio: string;
    fecha_fin: string;
    empresa: string;
    matricula: string;
}

export const FILTROS_VACIOS: FiltrosHistorico = { periodo: 'dia', fecha_inicio: '', fecha_fin: '', empresa: '', matricula: '' };

export interface MetaPaginacion {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

export const PER_PAGE_OPCIONES = [10, 20, 50, 100] as const;

/**
 * Horas decimales transcurridas entre dos instantes, a 2 decimales.
 * El tiempo de uso es tiempo de reloj: del registro del préstamo a la entrega.
 */
export const horasTranscurridas = (desde: string | null | undefined, hasta: Date = new Date()): number | null => {
    if (!desde) return null;

    const inicio = new Date(desde);
    if (Number.isNaN(inicio.getTime())) return null;

    const horas = (hasta.getTime() - inicio.getTime()) / 3_600_000;

    return horas < 0 ? 0 : Math.round(horas * 100) / 100;
};

/** "AAAA-MM-DDTHH:mm:ssZ" → "14/09/2026 10:00" en la hora local del proyecto. */
export const fechaHoraLocal = (valor: string | null | undefined): string => {
    if (!valor) return '—';

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return '—';

    return new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(fecha);
};

/** 0.75 → "00:45". Redondea al minuto. */
export const horasAHHMM = (horas: number | string | null | undefined): string => {
    const valor = Number(horas);
    if (horas === null || horas === undefined || horas === '' || !Number.isFinite(valor) || valor < 0) return '--:--';
    const totalMinutos = Math.round(valor * 60);
    const hh = Math.floor(totalMinutos / 60);
    const mm = totalMinutos % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

/** "125.3" → "125.30"; vacío/nulo → "—". */
export const formatearHoras = (valor: number | string | null | undefined): string => {
    const numero = Number(valor);
    if (valor === null || valor === undefined || valor === '' || !Number.isFinite(numero)) return '—';
    return numero.toFixed(2);
};

/** AAAA-MM-DD → DD/MM/AAAA sin pasar por Date (evita corrimientos por zona horaria). */
export const fechaCorta = (fecha: string): string => {
    const [a, m, d] = fecha.slice(0, 10).split('-');
    return a && m && d ? `${d}/${m}/${a}` : fecha;
};

/** Texto del botón de fechas; "Todas las fechas" mientras no se elija ninguna. */
export const etiquetaPeriodo = (filtros: FiltrosHistorico): string => {
    if (!filtros.fecha_inicio && !filtros.fecha_fin) return 'Todas las fechas';
    if (filtros.periodo === 'dia') return fechaCorta(filtros.fecha_inicio);
    if (filtros.periodo === 'rango') return `${fechaCorta(filtros.fecha_inicio)} / ${fechaCorta(filtros.fecha_fin)}`;
    if (filtros.periodo === 'mes') return filtros.fecha_inicio.substring(0, 7);

    return filtros.fecha_inicio.substring(0, 4);
};

/** Admin o quien tenga el subdepartamento relacionPlanta: el mismo criterio que subdep en backend. */
export const puedeOperarPlanta = (usuario?: UsuarioAutenticado | null): boolean => {
    if (!usuario) return false;
    if (usuario.isAdmin) return true;

    return (usuario.departamentos ?? []).some(departamento =>
        (departamento.subdepartamentos ?? []).some(sub => sub.route?.endsWith('relacionplanta')),
    );
};
