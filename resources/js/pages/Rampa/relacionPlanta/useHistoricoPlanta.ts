import { obtenerHistoricoPlantaApi } from '@/stores/apiRelacionPlanta';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FILTROS_VACIOS, type FiltrosHistorico, type MetaPaginacion, type Prestamo } from './types';

/**
 * Histórico paginado con filtros. Al cambiar de página hace scroll al inicio
 * de la tabla; al cambiar filtros o tamaño de página vuelve a la página 1.
 */
export function useHistoricoPlanta() {
    const [registros, setRegistros] = useState<Prestamo[]>([]);
    const [meta, setMeta] = useState<MetaPaginacion | null>(null);
    const [cargando, setCargando] = useState(true);
    const [filtros, setFiltrosEstado] = useState<FiltrosHistorico>(FILTROS_VACIOS);
    const [pagina, setPagina] = useState(1);
    const [porPagina, setPorPagina] = useState(20);
    const tablaRef = useRef<HTMLDivElement | null>(null);
    const peticionRef = useRef(0);

    const recargar = useCallback(async () => {
        const numero = ++peticionRef.current;
        setCargando(true);

        try {
            const respuesta = await obtenerHistoricoPlantaApi(filtros, pagina, porPagina);

            // Una respuesta vieja no pisa la de los filtros vigentes.
            if (numero !== peticionRef.current) return;

            setRegistros(respuesta.data);
            setMeta({
                current_page: respuesta.current_page,
                last_page: respuesta.last_page,
                per_page: respuesta.per_page,
                total: respuesta.total,
                from: respuesta.from,
                to: respuesta.to,
            });
        } catch (e) {
            console.error('No se pudo cargar el histórico de la GPU', e);
        } finally {
            if (numero === peticionRef.current) setCargando(false);
        }
    }, [filtros, pagina, porPagina]);

    useEffect(() => {
        recargar();
    }, [recargar]);

    const setFiltros = useCallback((cambio: Partial<FiltrosHistorico>) => {
        setFiltrosEstado(previos => ({ ...previos, ...cambio }));
        setPagina(1);
    }, []);

    const limpiarFiltros = useCallback(() => {
        setFiltrosEstado(FILTROS_VACIOS);
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
        meta,
        cargando,
        filtros,
        setFiltros,
        limpiarFiltros,
        pagina,
        cambiarPagina,
        porPagina,
        cambiarPorPagina,
        tablaRef,
        recargar,
    };
}
