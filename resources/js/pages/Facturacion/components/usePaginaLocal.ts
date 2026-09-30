import { useMemo, useState } from 'react';

/**
 * Paginación en el navegador de una lista que ya está completa en memoria.
 *
 * `reinicio` es una clave que resume los filtros vigentes: cuando cambia, se
 * vuelve a la página 1. La página nunca se sale de rango: si una baja o un
 * filtro dejan menos páginas de las que había, se muestra la última que existe
 * en vez de una página vacía con filas en otras.
 */
export function usePaginaLocal<T>(filas: T[], reinicio: string, porPaginaInicial = 20) {
    const [pagina, setPagina] = useState(1);
    const [porPagina, setPorPagina] = useState(porPaginaInicial);
    const [reinicioPrevio, setReinicioPrevio] = useState(reinicio);

    // Ajuste durante el render (patrón de React para estado derivado de una prop): evita pintar un cuadro con la página vieja.
    if (reinicioPrevio !== reinicio) {
        setReinicioPrevio(reinicio);
        setPagina(1);
    }

    const totalPaginas = Math.max(1, Math.ceil(filas.length / porPagina));
    const paginaActual = Math.min(pagina, totalPaginas);

    const enPagina = useMemo(() => filas.slice((paginaActual - 1) * porPagina, paginaActual * porPagina), [filas, paginaActual, porPagina]);

    const cambiarPorPagina = (cantidad: number) => {
        setPorPagina(cantidad);
        setPagina(1);
    };

    return { enPagina, pagina: paginaActual, totalPaginas, total: filas.length, porPagina, cambiarPagina: setPagina, cambiarPorPagina };
}
