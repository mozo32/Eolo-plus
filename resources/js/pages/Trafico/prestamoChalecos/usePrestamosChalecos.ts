import {
    devolverChalecoApi,
    guardarPrestamoChalecoApi,
    obtenerPrestamosChalecosApi,
    type NuevoPrestamo,
} from '@/stores/apiPrestamoChalecos';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FILTROS_PRESTAMOS_VACIOS, type FiltrosPrestamos, type PrestamoChaleco } from './types';

interface MetaPaginacion {
    pagina: number;
    totalPaginas: number;
    total: number;
}

/**
 * Histórico de préstamos contra la base de datos: el backend ordena (prestados
 * primero, luego del más reciente al más antiguo), filtra y pagina.
 */
export function usePrestamosChalecos() {
    const [registros, setRegistros] = useState<PrestamoChaleco[]>([]);
    const [meta, setMeta] = useState<MetaPaginacion>({ pagina: 1, totalPaginas: 1, total: 0 });
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [filtros, setFiltrosEstado] = useState<FiltrosPrestamos>(FILTROS_PRESTAMOS_VACIOS);
    const [pagina, setPagina] = useState(1);
    const [porPagina, setPorPagina] = useState(10);

    const tablaRef = useRef<HTMLDivElement | null>(null);
    const peticionRef = useRef(0);

    const recargar = useCallback(async () => {
        const numero = ++peticionRef.current;
        setCargando(true);

        try {
            const respuesta = await obtenerPrestamosChalecosApi(filtros, pagina, porPagina);

            // Una respuesta vieja no pisa la de los filtros vigentes.
            if (numero !== peticionRef.current) return;

            setRegistros(respuesta.data);
            setMeta({ pagina: respuesta.current_page, totalPaginas: Math.max(respuesta.last_page, 1), total: respuesta.total });
            setError(null);
        } catch (e) {
            if (numero !== peticionRef.current) return;
            setRegistros([]);
            setError(e instanceof Error ? e.message : 'No se pudieron cargar los préstamos.');
        } finally {
            if (numero === peticionRef.current) setCargando(false);
        }
    }, [filtros, pagina, porPagina]);

    useEffect(() => {
        recargar();
    }, [recargar]);

    /** Devuelve true si se guardó; el modal se cierra solo en ese caso. */
    const agregar = useCallback(
        async (datos: NuevoPrestamo): Promise<boolean> => {
            await guardarPrestamoChalecoApi(datos);
            setPagina(1);
            await recargar();

            return true;
        },
        [recargar],
    );

    const marcarDevuelto = useCallback(
        async (id: number) => {
            await devolverChalecoApi(id);
            await recargar();
        },
        [recargar],
    );

    const setFiltros = useCallback((cambio: Partial<FiltrosPrestamos>) => {
        setFiltrosEstado(previos => ({ ...previos, ...cambio }));
        setPagina(1);
    }, []);

    const limpiarFiltros = useCallback(() => {
        setFiltrosEstado(FILTROS_PRESTAMOS_VACIOS);
        setPagina(1);
    }, []);

    const cambiarPagina = useCallback((nueva: number) => {
        setPagina(nueva);
        tablaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const cambiarPorPagina = useCallback((cantidad: number) => {
        setPorPagina(cantidad);
        setPagina(1);
    }, []);

    return {
        registros,
        total: meta.total,
        pagina: meta.pagina,
        totalPaginas: meta.totalPaginas,
        porPagina,
        cargando,
        error,
        filtros,
        setFiltros,
        limpiarFiltros,
        cambiarPagina,
        cambiarPorPagina,
        tablaRef,
        agregar,
        marcarDevuelto,
        recargar,
    };
}

export type PrestamosChalecos = ReturnType<typeof usePrestamosChalecos>;
