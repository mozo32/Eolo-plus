import { useEffect, useRef } from 'react';

/**
 * Latido de sesión para una pantalla que se queda encendida todo el día.
 *
 * La sesión de Laravel expira a los 120 minutos sin peticiones. Una televisión
 * recibe sus datos por el websocket, que no toca la sesión, así que sin esto
 * acabaría mostrando la pantalla de login.
 *
 * No sustituye al broadcasting: los datos siguen llegando por el canal. Esto
 * solo dispara cada tantos minutos la consulta que ya existe, con lo que además
 * sirve de red por si se hubiera perdido algún evento.
 */
export function useSesionViva(minutos: number, refrescar: () => void) {
    const refrescarRef = useRef(refrescar);
    refrescarRef.current = refrescar;

    useEffect(() => {
        const intervalo = setInterval(() => refrescarRef.current(), minutos * 60_000);

        return () => clearInterval(intervalo);
    }, [minutos]);
}
