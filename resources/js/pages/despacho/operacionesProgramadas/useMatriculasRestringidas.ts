import {
    actualizarMatriculaRestringidaApi,
    agregarMatriculaRestringidaApi,
    eliminarMatriculaRestringidaApi,
    obtenerMatriculasRestringidasApi,
} from '@/stores/apiMatriculasRestringidas';
import { useCallback, useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import type { MatriculaRestringida } from './types';
import { EVENTO_RESTRICCIONES, useCanalProgramadas } from './useCanalProgramadas';

/** Carga que viaja por el canal cuando cambia una restricción. */
export interface EventoRestriccion {
    matricula: string;
    accion: 'agregada' | 'actualizada' | 'eliminada';
    llegada: boolean;
    salida: boolean;
}

const normalizar = (matricula: string) => matricula.trim().toUpperCase();

/**
 * Lista de matrículas restringidas: consulta, alta, switches, borrado y tiempo
 * real.
 *
 * Escucha el mismo canal público que Operaciones Programadas, con su propio
 * evento, reutilizando useCanalProgramadas para no duplicar la coalescencia ni
 * la resincronización tras una reconexión.
 */
export function useMatriculasRestringidas(activo: boolean) {
    const [restricciones, setRestricciones] = useState<MatriculaRestringida[]>([]);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [agregando, setAgregando] = useState(false);
    /** Matrículas con una petición en vuelo: bloquean su fila. */
    const [enVuelo, setEnVuelo] = useState<string[]>([]);

    const activoRef = useRef(activo);
    activoRef.current = activo;

    const cargar = useCallback(async (silencioso = false) => {
        if (!silencioso) setCargando(true);
        setError(null);

        try {
            const data = await obtenerMatriculasRestringidasApi();
            // La respuesta reemplaza la lista completa: nunca se concatena, así
            // que un evento repetido no puede duplicar filas.
            setRestricciones(Array.isArray(data) ? data : []);
        } catch (e) {
            setRestricciones([]);
            setError(e instanceof Error ? e.message : 'No se pudieron cargar las restricciones');
        } finally {
            setCargando(false);
        }
    }, []);

    // Se recarga cada vez que el modal se abre.
    useEffect(() => {
        if (!activo) return;
        cargar();
    }, [activo, cargar]);

    useCanalProgramadas<EventoRestriccion>({
        evento: EVENTO_RESTRICCIONES,
        // Solo mientras el modal está abierto vale la pena volver a consultar.
        leInteresa: () => activoRef.current,
        recargar: () => cargar(true),
    });

    const ocupada = useCallback((matricula: string) => enVuelo.includes(matricula), [enVuelo]);

    const marcar = (matricula: string, ocupado: boolean) =>
        setEnVuelo(previas =>
            ocupado
                ? previas.includes(matricula)
                    ? previas
                    : [...previas, matricula]
                : previas.filter(m => m !== matricula),
        );

    const agregar = useCallback(
        async (matriculaCruda: string): Promise<boolean> => {
            const matricula = normalizar(matriculaCruda);

            if (matricula === '') {
                Swal.fire({ icon: 'warning', title: 'Captura una matrícula' });
                return false;
            }

            if (restricciones.some(r => r.matricula === matricula)) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Matrícula repetida',
                    text: 'La matrícula seleccionada ya se encuentra en la lista de restricciones.',
                });
                return false;
            }

            setAgregando(true);

            try {
                const { restriccion } = await agregarMatriculaRestringidaApi(matricula);

                // Se agrega o se reemplaza por matrícula: si el evento en tiempo
                // real ya la había traído, no se duplica la fila.
                setRestricciones(previas => {
                    const resto = previas.filter(r => r.matricula !== restriccion.matricula);
                    return [...resto, restriccion].sort((a, b) => a.matricula.localeCompare(b.matricula));
                });

                return true;
            } catch (e) {
                Swal.fire({
                    icon: 'error',
                    title: 'No se pudo agregar',
                    text: e instanceof Error ? e.message : 'Error al agregar la matrícula',
                });
                return false;
            } finally {
                setAgregando(false);
            }
        },
        [restricciones],
    );

    /**
     * Cambio optimista: pinta el valor nuevo, bloquea la fila y, si el servidor
     * falla, regresa al valor anterior.
     */
    const cambiarSwitch = useCallback(
        async (matricula: string, campo: 'llegada' | 'salida', valor: boolean) => {
            if (enVuelo.includes(matricula)) return;

            const anterior = restricciones.find(r => r.matricula === matricula);
            if (!anterior) return;

            marcar(matricula, true);
            setRestricciones(previas =>
                previas.map(r => (r.matricula === matricula ? { ...r, [campo]: valor } : r)),
            );

            try {
                const { restriccion } = await actualizarMatriculaRestringidaApi(matricula, {
                    [campo]: valor,
                });

                setRestricciones(previas =>
                    previas.map(r => (r.matricula === matricula ? restriccion : r)),
                );
            } catch (e) {
                setRestricciones(previas =>
                    previas.map(r => (r.matricula === matricula ? anterior : r)),
                );

                Swal.fire({
                    icon: 'error',
                    title: 'No se pudo actualizar',
                    text: e instanceof Error ? e.message : 'Error al guardar la restricción',
                });
            } finally {
                marcar(matricula, false);
            }
        },
        [enVuelo, restricciones],
    );

    const eliminar = useCallback(
        async (matricula: string) => {
            if (enVuelo.includes(matricula)) return;

            const confirmacion = await Swal.fire({
                title: '¿Eliminar restricciones?',
                text: `¿Deseas eliminar las restricciones de la matrícula ${matricula}?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#dc2626',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar',
                reverseButtons: true,
            });

            if (!confirmacion.isConfirmed) return;

            marcar(matricula, true);

            try {
                await eliminarMatriculaRestringidaApi(matricula);
                setRestricciones(previas => previas.filter(r => r.matricula !== matricula));
            } catch (e) {
                Swal.fire({
                    icon: 'error',
                    title: 'No se pudo eliminar',
                    text: e instanceof Error ? e.message : 'Error al eliminar la restricción',
                });
            } finally {
                marcar(matricula, false);
            }
        },
        [enVuelo],
    );

    return {
        restricciones,
        cargando,
        error,
        agregando,
        ocupada,
        agregar,
        cambiarSwitch,
        eliminar,
        recargar: () => cargar(true),
    };
}

/**
 * Lo que la pantalla comparte entre el icono de alerta y el modal, para montar
 * una sola instancia del hook.
 */
export type RestriccionesEnPantalla = ReturnType<typeof useMatriculasRestringidas>;
