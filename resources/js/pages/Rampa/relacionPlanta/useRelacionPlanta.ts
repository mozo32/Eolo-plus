import { ErrorApi, finalizarPrestamoApi, obtenerPrestamoActualApi, prestarGpuApi } from '@/stores/apiRelacionPlanta';
import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import type { EntregaPayload, Prestamo, PrestamoPayload } from './types';

const toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3500, timerProgressBar: true });

/**
 * Estado de la GPU N.115: el préstamo abierto (o null) y las dos acciones.
 * Un 409 significa que otro usuario se adelantó: se avisa y se recarga.
 */
export function useRelacionPlanta() {
    const [actual, setActual] = useState<Prestamo | null>(null);
    /** Horómetro con el que terminó el préstamo anterior; precarga el formulario. */
    const [ultimoHorometroFin, setUltimoHorometroFin] = useState<string | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const recargar = useCallback(async () => {
        try {
            const { prestamo, ultimoHorometroFin: ultimo } = await obtenerPrestamoActualApi();
            setActual(prestamo);
            setUltimoHorometroFin(ultimo);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo consultar el estado de la GPU.');
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        recargar();
    }, [recargar]);

    const prestar = useCallback(
        async (payload: PrestamoPayload): Promise<boolean> => {
            try {
                const { message, prestamo } = await prestarGpuApi(payload);
                setActual(prestamo);
                toast.fire({ icon: 'success', title: message });
                return true;
            } catch (e) {
                if (e instanceof ErrorApi && e.codigo === 'gpu_en_uso') {
                    await Swal.fire({ icon: 'warning', title: 'GPU no disponible', text: e.message, confirmButtonText: 'Entendido' });
                    recargar();
                    return false;
                }

                Swal.fire({
                    icon: 'error',
                    title: 'No se pudo registrar el préstamo',
                    text: e instanceof Error ? e.message : 'Error inesperado',
                });
                return false;
            }
        },
        [recargar],
    );

    const finalizar = useCallback(
        async (id: number, payload: EntregaPayload): Promise<boolean> => {
            try {
                const { message } = await finalizarPrestamoApi(id, payload);
                setActual(null);
                toast.fire({ icon: 'success', title: message });
                return true;
            } catch (e) {
                if (e instanceof ErrorApi && e.codigo === 'ya_finalizado') {
                    await Swal.fire({ icon: 'info', title: 'Préstamo ya finalizado', text: e.message, confirmButtonText: 'Entendido' });
                    recargar();
                    // El modal debe cerrarse: ya no hay nada que finalizar.
                    return true;
                }

                Swal.fire({
                    icon: 'error',
                    title: 'No se pudo registrar la entrega',
                    text: e instanceof Error ? e.message : 'Error inesperado',
                });
                return false;
            }
        },
        [recargar],
    );

    return { actual, ultimoHorometroFin, cargando, error, recargar, prestar, finalizar };
}
