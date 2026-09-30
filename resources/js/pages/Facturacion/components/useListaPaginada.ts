import type { Pagina } from '@/stores/apiFacturacionCatalogos';
import { useCallback, useEffect, useRef, useState } from 'react';

interface MetaPaginacion {
    pagina: number;
    totalPaginas: number;
    total: number;
}

const ESPERA_BUSQUEDA_MS = 350;

interface Opciones<T, F extends { q: string }> {
    /** Pide una página al servidor con los filtros vigentes. Debe ser una función estable (de módulo). */
    obtener: (filtros: F, pagina: number, porPagina: number) => Promise<Pagina<T>>;
    /** Filtros sin ninguno aplicado; también lo que restablece "limpiar". Debe ser un objeto estable (de módulo). */
    vacios: F;
    /** Mensaje cuando el error no trae uno propio. */
    mensajeError: string;
}

/**
 * Lista paginada contra el servidor: el backend filtra y pagina, y la búsqueda
 * (`q`) espera a que el usuario termine de teclear. Descarta las respuestas
 * viejas y corrige la página cuando queda fuera de rango (se dio de baja la
 * última fila de la última página).
 *
 * `F` son los filtros; siempre traen `q`, la búsqueda de texto.
 */
export function useListaPaginada<T, F extends { q: string }>({ obtener, vacios, mensajeError }: Opciones<T, F>) {
    const [registros, setRegistros] = useState<T[]>([]);
    const [meta, setMeta] = useState<MetaPaginacion>({ pagina: 1, totalPaginas: 1, total: 0 });
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [filtros, setFiltrosEstado] = useState<F>(vacios);
    const [busqueda, setBusqueda] = useState('');
    const [pagina, setPagina] = useState(1);
    const [porPagina, setPorPagina] = useState(20);

    const peticionRef = useRef(0);

    const recargar = useCallback(async () => {
        const numero = ++peticionRef.current;
        let corrigiendoPagina = false;
        setCargando(true);

        try {
            const respuesta = await obtener(filtros, pagina, porPagina);

            // Una respuesta vieja no pisa la de los filtros vigentes.
            if (numero !== peticionRef.current) return;

            // Se quitó la última fila de la última página: el servidor contesta vacío con una página más allá
            // de la última. Se vuelve a la última que existe en vez de mostrar "no hay nada" con datos en otras páginas.
            if (respuesta.data.length === 0 && respuesta.last_page >= 1 && respuesta.current_page > respuesta.last_page) {
                corrigiendoPagina = true;
                setPagina(respuesta.last_page);
                return;
            }

            setRegistros(respuesta.data);
            setMeta({ pagina: respuesta.current_page, totalPaginas: Math.max(respuesta.last_page, 1), total: respuesta.total });
            setError(null);
        } catch (e) {
            if (numero !== peticionRef.current) return;
            setRegistros([]);
            setError(e instanceof Error ? e.message : mensajeError);
        } finally {
            // Al corregir la página el efecto vuelve a pedir; se conserva "cargando" para no parpadear un vacío falso.
            if (numero === peticionRef.current && !corrigiendoPagina) setCargando(false);
        }
    }, [obtener, mensajeError, filtros, pagina, porPagina]);

    useEffect(() => {
        recargar();
    }, [recargar]);

    // La búsqueda viaja al servidor solo cuando el usuario deja de teclear.
    useEffect(() => {
        const temporizador = setTimeout(() => {
            setFiltrosEstado(previos => (previos.q === busqueda ? previos : { ...previos, q: busqueda }));
            setPagina(1);
        }, ESPERA_BUSQUEDA_MS);

        return () => clearTimeout(temporizador);
    }, [busqueda]);

    const setFiltros = useCallback((cambio: Partial<Omit<F, 'q'>>) => {
        setFiltrosEstado(previos => ({ ...previos, ...cambio }));
        setPagina(1);
    }, []);

    const limpiarFiltros = useCallback(() => {
        setBusqueda('');
        setFiltrosEstado(vacios);
        setPagina(1);
    }, [vacios]);

    const cambiarPorPagina = useCallback((cantidad: number) => {
        setPorPagina(cantidad);
        setPagina(1);
    }, []);

    const hayFiltros = busqueda !== '' || (Object.keys(vacios) as (keyof F)[]).some(clave => clave !== 'q' && filtros[clave] !== vacios[clave]);

    return {
        registros,
        total: meta.total,
        pagina: meta.pagina,
        totalPaginas: meta.totalPaginas,
        porPagina,
        cargando,
        error,
        filtros,
        busqueda,
        setBusqueda,
        setFiltros,
        limpiarFiltros,
        hayFiltros,
        cambiarPagina: setPagina,
        cambiarPorPagina,
        recargar,
    };
}
