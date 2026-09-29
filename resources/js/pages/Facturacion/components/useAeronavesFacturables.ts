import {
    FILTROS_AERONAVES_VACIOS,
    obtenerAeronavesFacturablesApi,
    type AeronaveFacturable,
    type FiltrosAeronaves,
} from '@/stores/apiFacturacionCatalogos';
import { useCallback, useEffect, useRef, useState } from 'react';

interface MetaPaginacion {
    pagina: number;
    totalPaginas: number;
    total: number;
}

const ESPERA_BUSQUEDA_MS = 350;

/**
 * Matrículas con sus datos de cobro, contra la base de datos: el backend
 * ordena por matrícula, filtra y pagina. La búsqueda por matrícula espera a que
 * el usuario termine de teclear.
 */
export function useAeronavesFacturables() {
    const [registros, setRegistros] = useState<AeronaveFacturable[]>([]);
    const [meta, setMeta] = useState<MetaPaginacion>({ pagina: 1, totalPaginas: 1, total: 0 });
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [filtros, setFiltrosEstado] = useState<FiltrosAeronaves>(FILTROS_AERONAVES_VACIOS);
    const [busqueda, setBusqueda] = useState('');
    const [pagina, setPagina] = useState(1);
    const [porPagina, setPorPagina] = useState(20);

    const peticionRef = useRef(0);

    const recargar = useCallback(async () => {
        const numero = ++peticionRef.current;
        setCargando(true);

        try {
            const respuesta = await obtenerAeronavesFacturablesApi(filtros, pagina, porPagina);

            // Una respuesta vieja no pisa la de los filtros vigentes.
            if (numero !== peticionRef.current) return;

            setRegistros(respuesta.data);
            setMeta({ pagina: respuesta.current_page, totalPaginas: Math.max(respuesta.last_page, 1), total: respuesta.total });
            setError(null);
        } catch (e) {
            if (numero !== peticionRef.current) return;
            setRegistros([]);
            setError(e instanceof Error ? e.message : 'No se pudieron cargar las matrículas.');
        } finally {
            if (numero === peticionRef.current) setCargando(false);
        }
    }, [filtros, pagina, porPagina]);

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

    const setFiltros = useCallback((cambio: Partial<Omit<FiltrosAeronaves, 'q'>>) => {
        setFiltrosEstado(previos => ({ ...previos, ...cambio }));
        setPagina(1);
    }, []);

    const limpiarFiltros = useCallback(() => {
        setBusqueda('');
        setFiltrosEstado(FILTROS_AERONAVES_VACIOS);
        setPagina(1);
    }, []);

    const cambiarPorPagina = useCallback((cantidad: number) => {
        setPorPagina(cantidad);
        setPagina(1);
    }, []);

    const hayFiltros = busqueda !== '' || filtros.estatus !== '' || filtros.sin_categoria;

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
