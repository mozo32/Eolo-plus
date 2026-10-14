import { useCanalProgramadas } from '@/pages/despacho/operacionesProgramadas/useCanalProgramadas';
import {
    obtenerLlegadasPendientesApi,
    type LlegadaOperacion,
} from '@/stores/apiFacturacionCatalogos';
import { useCallback, useEffect, useRef, useState } from 'react';

export const CANAL_PENDIENTES = 'prefacturas-pendientes';
export const EVENTO_PENDIENTES = 'PrefacturaPendienteCambio';

/** Carga mínima del aviso. No reconstruye nada: solo dice que conviene volver a preguntar. */
export interface EventoPendiente {
    accion: 'creada' | 'actualizada' | 'eliminada' | 'tomada' | 'liberada';
    operacion_id: number | null;
    matricula: string | null;
}

/**
 * Las llegadas pendientes de prefactura, al día.
 *
 * Una sola consulta alimenta el número del botón y la lista del panel, así un aviso nunca
 * dispara dos peticiones iguales.
 *
 * La suscripción se delega en `useCanalProgramadas`, que pese al nombre es genérico —recibe
 * el canal y el evento— y ya resuelve tres cosas que aquí harían falta igual: agrupar las
 * ráfagas en una sola consulta, no duplicar oyentes en el doble montaje de Strict Mode, y
 * volver a consultar después de una reconexión. Esto último es lo que hace que la alerta se
 * recupere sola si el servidor de websockets se cae un rato: los avisos perdidos mientras
 * estuvo caído se recuperan de una consulta, no se quedan colgados.
 *
 * `leInteresa` devuelve siempre verdadero: las cinco acciones mueven el contador, así que no
 * hay ninguna que convenga ignorar.
 */
export function useLlegadasPendientes() {
    const [llegadas, setLlegadas] = useState<LlegadaOperacion[]>([]);
    const [total, setTotal] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const montadoRef = useRef(true);

    useEffect(() => {
        montadoRef.current = true;

        return () => {
            montadoRef.current = false;
        };
    }, []);

    const cargar = useCallback(async (silencioso = false) => {
        if (!silencioso) setCargando(true);
        setError(null);

        try {
            const respuesta = await obtenerLlegadasPendientesApi();

            // La respuesta reemplaza la lista completa: nunca se concatena, así que un
            // aviso repetido no puede duplicar tarjetas.
            if (!montadoRef.current) return;
            setLlegadas(Array.isArray(respuesta?.data) ? respuesta.data : []);
            setTotal(
                typeof respuesta?.total === 'number' ? respuesta.total : 0,
            );
        } catch (e) {
            if (!montadoRef.current) return;
            setError(
                e instanceof Error
                    ? e.message
                    : 'No se pudieron cargar las llegadas pendientes',
            );
        } finally {
            if (montadoRef.current) setCargando(false);
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    useCanalProgramadas<EventoPendiente>({
        canal: CANAL_PENDIENTES,
        evento: EVENTO_PENDIENTES,
        leInteresa: () => true,
        recargar: () => void cargar(true),
    });

    return {
        llegadas,
        total,
        cargando,
        error,
        recargar: () => void cargar(true),
    };
}
