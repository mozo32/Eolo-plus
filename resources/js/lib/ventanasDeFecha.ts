import { usePage } from '@inertiajs/react'

type Ventana = { min: string | null; max: string | null }

/**
 * La ventana de un formulario, para pasarla como `min`/`max` a un `<input type="date">`.
 *
 * El navegador GUÍA y el servidor DECIDE: si una pestaña lleva abierta desde anoche, su
 * ventana es la de ayer y el servidor rechazará la fecha con un mensaje que nombra las dos
 * fechas. No se recalcula aquí a propósito, porque el reloj del cliente puede estar mal.
 */
export function useVentanaDeFecha(clave: string): { min?: string; max?: string } {
    const ventanas = (usePage().props as { ventanasDeFecha?: Record<string, Ventana> })
        .ventanasDeFecha

    const ventana = ventanas?.[clave]

    return {
        min: ventana?.min ?? undefined,
        max: ventana?.max ?? undefined,
    }
}
