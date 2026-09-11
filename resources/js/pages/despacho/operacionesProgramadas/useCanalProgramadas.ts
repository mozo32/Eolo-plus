import { useConnectionStatus, useEchoPublic } from '@laravel/echo-react';
import { useCallback, useEffect, useRef } from 'react';
import { fechaHoy, type ModuloConsumidor, type TipoOperacion } from './types';

export const CANAL_PROGRAMADAS = 'operaciones-programadas';
/** Canal público de la televisión: solo lleva cambios de operaciones, nunca restricciones. */
export const CANAL_PANTALLA = 'pantalla-programadas';
export const EVENTO_PROGRAMADAS = 'OperacionProgramadaCambio';
export const EVENTO_RESTRICCIONES = 'MatriculaRestringidaCambio';

export type AccionProgramada = 'creada' | 'actualizada' | 'eliminada' | 'utilizada';

/** Carga mínima que viaja por el canal. Sirve para decidir si vale la pena consultar. */
export interface EventoProgramada {
    id: number;
    accion: AccionProgramada;
    fecha: string | null;
    tipo: TipoOperacion | null;
    fecha_anterior: string | null;
    modulo: ModuloConsumidor | null;
}

/** Milisegundos que se esperan para agrupar una ráfaga de eventos en una sola consulta. */
const MS_COALESCENCIA = 250;

/** Cada cuánto se compara el reloj para detectar el cambio de día. No hace red. */
const MS_RELOJ = 60_000;

interface Opciones<T> {
    /** Canal que se escucha. Por omisión el interno; la televisión pasa el suyo. */
    canal?: string;
    /**
     * Evento del canal que se escucha. Por omisión, el de operaciones
     * programadas; las restricciones de matrícula pasan el suyo y así reutilizan
     * la coalescencia y la resincronización sin duplicarlas.
     */
    evento?: string;
    /**
     * Decide si el evento recibido obliga a volver a consultar. Se evalúa con
     * los datos vigentes, así que debe leer de refs y no de estado capturado.
     */
    leInteresa: (evento: T) => boolean;
    /** Vuelve a consultar. Se llama ya agrupada la ráfaga de eventos. */
    recargar: () => void;
    /** Se ejecuta con cada evento recibido, interese o no volver a consultar. */
    alRecibir?: (evento: T) => void;
    /** Se avisa cuando cambia el día local mientras la pantalla sigue abierta. */
    alCambiarDeDia?: (nuevaFecha: string) => void;
}

/**
 * Suscripción en tiempo real al canal de operaciones programadas.
 *
 * Reutiliza el mismo mecanismo que Remisiones: canal público y useEchoPublic,
 * que ya resuelve la suscripción única, la limpieza al desmontar y el doble
 * montaje de React Strict Mode. Aquí se le añade lo que este módulo necesita:
 *
 * - Agrupar ráfagas para no lanzar varias consultas idénticas por un solo cambio.
 * - Resincronizar con el servidor después de una reconexión, para recuperar los
 *   eventos que se hayan perdido mientras el socket estuvo caído.
 * - Detectar el cambio de día sin hacer polling de datos: solo se compara la
 *   fecha local; la consulta se dispara únicamente cuando el día cambia.
 */
export function useCanalProgramadas<T = EventoProgramada>({
    canal: nombreCanal = CANAL_PROGRAMADAS,
    evento: nombreEvento = EVENTO_PROGRAMADAS,
    leInteresa,
    recargar,
    alRecibir,
    alCambiarDeDia,
}: Opciones<T>) {
    const leInteresaRef = useRef(leInteresa);
    const recargarRef = useRef(recargar);
    const alRecibirRef = useRef(alRecibir);
    const alCambiarDeDiaRef = useRef(alCambiarDeDia);
    const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    leInteresaRef.current = leInteresa;
    recargarRef.current = recargar;
    alRecibirRef.current = alRecibir;
    alCambiarDeDiaRef.current = alCambiarDeDia;

    const recargarAgrupado = useCallback(() => {
        if (temporizadorRef.current) return;

        temporizadorRef.current = setTimeout(() => {
            temporizadorRef.current = null;
            recargarRef.current();
        }, MS_COALESCENCIA);
    }, []);

    useEffect(() => {
        return () => {
            if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
        };
    }, []);

    // El callback no lleva dependencias: la lógica vive en refs para no
    // resuscribirse en cada render ni duplicar listeners.
    useEchoPublic<T>(
        nombreCanal,
        nombreEvento,
        evento => {
            if (!evento) return;

            alRecibirRef.current?.(evento);

            if (!leInteresaRef.current(evento)) return;

            recargarAgrupado();
        },
        [],
    );

    // Resincronización tras una reconexión.
    const estadoConexion = useConnectionStatus();
    const estuvoDesconectado = useRef(false);

    useEffect(() => {
        if (estadoConexion !== 'connected') {
            if (estadoConexion === 'disconnected' || estadoConexion === 'reconnecting') {
                estuvoDesconectado.current = true;
            }
            return;
        }

        if (!estuvoDesconectado.current) return;

        estuvoDesconectado.current = false;
        recargarRef.current();
    }, [estadoConexion]);

    // Cambio de día con la pantalla abierta.
    useEffect(() => {
        if (!alCambiarDeDiaRef.current) return;

        let fechaVigente = fechaHoy();

        const revisarDia = () => {
            const hoy = fechaHoy();
            if (hoy === fechaVigente) return;

            fechaVigente = hoy;
            alCambiarDeDiaRef.current?.(hoy);
        };

        const reloj = setInterval(revisarDia, MS_RELOJ);
        document.addEventListener('visibilitychange', revisarDia);
        window.addEventListener('focus', revisarDia);

        return () => {
            clearInterval(reloj);
            document.removeEventListener('visibilitychange', revisarDia);
            window.removeEventListener('focus', revisarDia);
        };
    }, []);
}

/**
 * ¿El evento toca la fecha que se está mostrando?
 * Se revisa también la fecha anterior para captar una operación que salió o
 * entró a ese día al actualizarse.
 */
export const tocaLaFecha = (evento: EventoProgramada, fecha: string): boolean =>
    evento.fecha === fecha || evento.fecha_anterior === fecha;
