import {
    eliminarOperacionProgramadaApi,
    obtenerOperacionesProgramadasApi,
} from '@/stores/apiOperacionesProgramadas';
import { useCallback, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { fechaHoy, type OperacionProgramada, type TabProgramadas } from './types';
import { tocaLaFecha, useCanalProgramadas } from './useCanalProgramadas';

/**
 * Estado de la pantalla de Operaciones Programadas: fecha consultada, tab
 * activo, listas y recarga. Mantiene tontos a los componentes de tabla.
 */
export function useOperacionesProgramadas() {
    const [fecha, setFecha] = useState<string>(() => fechaHoy());
    const [tab, setTab] = useState<TabProgramadas>('ambas');
    const [salidas, setSalidas] = useState<OperacionProgramada[]>([]);
    const [llegadas, setLlegadas] = useState<OperacionProgramada[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // La fecha vigente se lee desde una ref dentro del listener del canal, para
    // no volver a suscribirse cada vez que el usuario cambia de día.
    const fechaRef = useRef(fecha);
    fechaRef.current = fecha;

    // Deja de seguir a "hoy" en cuanto el usuario elige una fecha a mano.
    const siguiendoHoy = useRef(true);

    const cargar = useCallback(async (silencioso = false) => {
        if (!silencioso) setCargando(true);
        setError(null);

        try {
            const data = await obtenerOperacionesProgramadasApi(fechaRef.current);
            // La respuesta reemplaza ambas listas completas: los totales, el
            // movimiento entre tablas y los borrados quedan resueltos por el
            // servidor, y no hay forma de duplicar una fila.
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
        leInteresa: evento => tocaLaFecha(evento, fechaRef.current),
        recargar: () => cargar(true),
        alCambiarDeDia: nuevaFecha => {
            // Si el usuario está consultando otro día, se respeta su selección.
            if (!siguiendoHoy.current) return;
            setFecha(nuevaFecha);
        },
    });

    const eliminar = useCallback(
        async (operacion: OperacionProgramada) => {
            const yaUsada = operacion.modulos_usados.length > 0;

            const confirmacion = await Swal.fire({
                title: yaUsada ? '¿Cancelar la programación?' : '¿Eliminar la operación programada?',
                html: yaUsada
                    ? `La operación <b>#${operacion.id}</b> de la matrícula <b>${operacion.matricula}</b> ya se utilizó en un registro terminado. Se conservará para la trazabilidad y dejará de aparecer en la lista.`
                    : `Se eliminará la operación <b>#${operacion.id}</b> de la matrícula <b>${operacion.matricula}</b>.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#dc2626',
                confirmButtonText: yaUsada ? 'Sí, cancelar' : 'Sí, eliminar',
                cancelButtonText: 'No',
            });

            if (!confirmacion.isConfirmed) return;

            try {
                const respuesta = await eliminarOperacionProgramadaApi(operacion.id);
                await cargar();
                Swal.fire({
                    icon: 'success',
                    title: 'Listo',
                    text: respuesta.message,
                    timer: 2200,
                    showConfirmButton: false,
                });
            } catch (e) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: e instanceof Error ? e.message : 'No se pudo eliminar la operación',
                });
            }
        },
        [cargar],
    );

    const cambiarFecha = useCallback((nuevaFecha: string) => {
        siguiendoHoy.current = nuevaFecha === fechaHoy();
        setFecha(nuevaFecha);
    }, []);

    return {
        fecha,
        setFecha: cambiarFecha,
        tab,
        setTab,
        salidas,
        llegadas,
        cargando,
        error,
        cargar,
        eliminar,
    };
}
