import { obtenerPantallaProgramadasApi } from '@/stores/apiOperacionesProgramadas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fechaHoy, type OperacionPantalla } from './types';
import { CANAL_PANTALLA, tocaLaFecha, useCanalProgramadas } from './useCanalProgramadas';

/** Cada cuánto se resincroniza con el servidor, por si Reverb se reinició. */
const MINUTOS_RESINCRONIZACION = 15;

/**
 * Datos de la televisión pública.
 *
 * Consume el endpoint público de solo lectura y escucha el canal público de la
 * televisión, que solo transmite cambios de operaciones. Sin sesión: no hay
 * nada que mantener vivo; la resincronización periódica es solo una red por si
 * se perdió algún evento con el websocket caído.
 *
 * Cada recarga reemplaza las listas completas, así que varios eventos de la
 * misma operación nunca duplican una fila.
 */
export function usePantallaProgramadas() {
    const [fecha, setFecha] = useState<string>(() => fechaHoy());
    const [salidas, setSalidas] = useState<OperacionPantalla[]>([]);
    const [llegadas, setLlegadas] = useState<OperacionPantalla[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fechaRef = useRef(fecha);
    fechaRef.current = fecha;

    const cargar = useCallback(async (silencioso = false) => {
        if (!silencioso) setCargando(true);
        setError(null);

        try {
            const data = await obtenerPantallaProgramadasApi();
            setSalidas(data.salidas ?? []);
            setLlegadas(data.llegadas ?? []);
        } catch (e) {
            setSalidas([]);
            setLlegadas([]);
            setError(e instanceof Error ? e.message : 'No se pudieron cargar las operaciones programadas');
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargar();
    }, [cargar, fecha]);

    useCanalProgramadas({
        canal: CANAL_PANTALLA,
        leInteresa: evento => tocaLaFecha(evento, fechaRef.current),
        recargar: () => cargar(true),
        // A medianoche se limpia el día anterior y se consulta el nuevo.
        alCambiarDeDia: nuevaFecha => setFecha(nuevaFecha),
    });

    useEffect(() => {
        const intervalo = setInterval(() => cargar(true), MINUTOS_RESINCRONIZACION * 60_000);

        return () => clearInterval(intervalo);
    }, [cargar]);

    return { fecha, salidas, llegadas, cargando, error };
}
