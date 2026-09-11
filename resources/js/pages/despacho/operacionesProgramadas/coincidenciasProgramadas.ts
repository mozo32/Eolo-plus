import Swal from 'sweetalert2';
import { esHoraFutura, type OperacionProgramada } from './types';

/**
 * Alertas compartidas entre el panel de programadas y la detección al capturar
 * la matrícula. Todas usan el sistema de alertas del proyecto; ninguna abre un
 * modal propio.
 */

const etiquetaTipo = (tipo: OperacionProgramada['tipo']) => (tipo === 'llegada' ? 'llegada' : 'salida');

/**
 * Si la operación es de hoy y su hora todavía no llega, pide confirmación.
 * Es informativa: el usuario puede continuar. Resuelve true para continuar.
 */
export async function confirmarHoraFutura(operacion: OperacionProgramada): Promise<boolean> {
    if (!esHoraFutura(operacion.fecha, operacion.hora)) return true;

    const respuesta = await Swal.fire({
        title: 'Aún no es la hora programada',
        text: `Esta operación está programada para las ${operacion.hora}. Aún no es la hora programada. ¿Deseas continuar de todos modos?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, continuar',
        cancelButtonText: 'Cancelar',
        reverseButtons: true,
    });

    return respuesta.isConfirmed;
}

/**
 * Una sola coincidencia: ofrece cargarla o seguir con el registro imprevisto.
 * Resuelve la operación si el usuario la carga, o null si continúa a mano.
 */
export async function preguntarUnaCoincidencia(operacion: OperacionProgramada): Promise<OperacionProgramada | null> {
    const respuesta = await Swal.fire({
        title: 'Operación programada encontrada',
        text: `La matrícula ${operacion.matricula} tiene una ${etiquetaTipo(operacion.tipo)} programada para hoy a las ${operacion.hora}. Se encontró información que puede cargarse en este formulario.`,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Cargar información',
        cancelButtonText: 'Continuar manualmente',
        confirmButtonColor: '#00677F',
        reverseButtons: true,
        allowOutsideClick: false,
    });

    return respuesta.isConfirmed ? operacion : null;
}

const describir = (operacion: OperacionProgramada): string => {
    const partes = [
        operacion.hora,
        operacion.tipo === 'llegada' ? 'Llegada' : 'Salida',
        operacion.lugar || '—',
        operacion.equipo,
        operacion.pax === null ? '— PAX' : `${operacion.pax} PAX`,
    ];

    if (operacion.observaciones) partes.push(operacion.observaciones);

    return partes.join(' · ');
};

/**
 * Varias coincidencias: nunca se elige la primera sola. El usuario escoge una
 * o continúa a mano. Resuelve la elegida, o null si continúa manualmente.
 */
export async function elegirEntreVarias(operaciones: OperacionProgramada[]): Promise<OperacionProgramada | null> {
    const opciones = Object.fromEntries(operaciones.map(op => [String(op.id), describir(op)]));

    const respuesta = await Swal.fire<string>({
        title: 'Varias operaciones programadas',
        text: `La matrícula ${operaciones[0].matricula} tiene ${operaciones.length} operaciones programadas para hoy. Elige cuál deseas cargar.`,
        icon: 'info',
        input: 'radio',
        inputOptions: opciones,
        inputValidator: valor => (valor ? null : 'Elige una operación o continúa manualmente.'),
        showCancelButton: true,
        confirmButtonText: 'Cargar información',
        cancelButtonText: 'Continuar manualmente',
        confirmButtonColor: '#00677F',
        reverseButtons: true,
        allowOutsideClick: false,
        customClass: { input: 'text-left text-sm' },
    });

    if (!respuesta.isConfirmed || !respuesta.value) return null;

    return operaciones.find(op => String(op.id) === respuesta.value) ?? null;
}

/**
 * Alguien más ya tiene esa programación abierta en otra pestaña.
 */
export function avisarProgramadaEnOtraPestana(titulo: string): void {
    Swal.fire({
        icon: 'warning',
        title: 'Ya está abierta en otra pestaña',
        text: `Esta operación programada ya está seleccionada en la pestaña "${titulo}". Te llevo ahí para que no se registre dos veces.`,
        confirmButtonText: 'Entendido',
    });
}
