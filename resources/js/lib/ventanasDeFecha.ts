import { usePage } from '@inertiajs/react'

type Ventana = { min: string | null; max: string | null }

const DIA = /^\d{4}-\d{2}-\d{2}/

/**
 * La ventana de un formulario, para pasarla como `min`/`max` a un `<input type="date">`.
 *
 * El navegador GUÍA y el servidor DECIDE: si una pestaña lleva abierta desde anoche, su
 * ventana es la de ayer y el servidor rechazará la fecha con un mensaje que nombra las dos
 * fechas. No se recalcula aquí a propósito, porque el reloj del cliente puede estar mal.
 *
 * `fechaOriginal` es para editar: la fecha con la que el registro ya está guardado. El
 * servidor deja intacta esa fecha aunque esté fuera de la ventana (solo juzga una fecha
 * NUEVA), y el navegador tiene que reflejar lo mismo; si no, el `min` bloquearía guardar
 * un registro viejo sin tocarle la fecha. Por eso la ventana pasa a ser la unión de la del
 * servidor y esa fecha.
 */
export function useVentanaDeFecha(
    clave: string,
    fechaOriginal?: string | null,
): { min?: string; max?: string } {
    const ventanas = (usePage().props as { ventanasDeFecha?: Record<string, Ventana> })
        .ventanasDeFecha

    const ventana = ventanas?.[clave]
    const original = fechaOriginal && DIA.test(fechaOriginal) ? fechaOriginal.slice(0, 10) : null

    let min = ventana?.min ?? undefined
    let max = ventana?.max ?? undefined

    if (original) {
        if (min !== undefined && original < min) min = original
        if (max !== undefined && original > max) max = original
    }

    return { min, max }
}
