import { obtenerProgramadasPendientesApi } from '@/stores/apiOperacionesProgramadas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fechaHoy, type ModuloConsumidor, type OperacionProgramada } from './types';
import { tocaLaFecha, useCanalProgramadas, type EventoProgramada } from './useCanalProgramadas';

/**
 * Operaciones programadas pendientes de hoy para un módulo.
 *
 * Una sola consulta alimenta el badge del botón y la lista del panel, así un
 * evento nunca dispara dos peticiones iguales.
 *
 * El estado de utilización es independiente por módulo: este hook solo pide las
 * pendientes del suyo y solo reacciona a un evento "utilizada" cuando proviene
 * de ese mismo módulo. Usar una programación en Operaciones Diarias no genera
 * ni tráfico ni cambios en el contador de WalkAround.
 */
export function useProgramadasPendientes(
    modulo: ModuloConsumidor,
    opciones: { alUtilizarEnEsteModulo?: (evento: EventoProgramada) => void } = {},
) {
    const [fecha, setFecha] = useState<string>(() => fechaHoy());
    const [operaciones, setOperaciones] = useState<OperacionProgramada[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fechaRef = useRef(fecha);
    fechaRef.current = fecha;

    const alUtilizarRef = useRef(opciones.alUtilizarEnEsteModulo);
    alUtilizarRef.current = opciones.alUtilizarEnEsteModulo;

    // Evita que una recarga manual y la del evento en tiempo real disparen dos
    // consultas idénticas con milisegundos de diferencia.
    const ultimaCargaRef = useRef(0);

    const cargar = useCallback(
        async (silencioso = false) => {
            const ahora = Date.now();
            if (silencioso && ahora - ultimaCargaRef.current < 250) return;
            ultimaCargaRef.current = ahora;

            if (!silencioso) setCargando(true);
            setError(null);

            try {
                const data = await obtenerProgramadasPendientesApi({
                    modulo,
                    fecha: fechaRef.current,
                });

                // La respuesta del servidor reemplaza la lista completa: nunca se
                // concatena, así que un evento repetido no puede duplicar filas.
                setOperaciones(Array.isArray(data) ? data : []);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'No se pudieron cargar las operaciones programadas');
            } finally {
                setCargando(false);
            }
        },
        [modulo],
    );

    useEffect(() => {
        cargar();
    }, [cargar, fecha]);

    useCanalProgramadas({
        // Solo baja el contador del módulo que realmente utilizó la programación.
        leInteresa: evento =>
            (evento.accion !== 'utilizada' || evento.modulo === modulo) &&
            tocaLaFecha(evento, fechaRef.current),

        alRecibir: evento => {
            // Aviso para quien tenga esa programación abierta en un formulario.
            if (evento.accion === 'utilizada' && evento.modulo === modulo) {
                alUtilizarRef.current?.(evento);
            }
        },

        recargar: () => cargar(true),
        alCambiarDeDia: nuevaFecha => setFecha(nuevaFecha),
    });

    return {
        fecha,
        operaciones,
        total: operaciones.length,
        cargando,
        error,
        recargar: () => cargar(true),
    };
}
