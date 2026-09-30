import { type ApiCatalogo, type FiltroEstado } from '@/stores/apiFacturacionCatalogos';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizarBusqueda } from './formato';
import type { RegistroCatalogo } from './ModalCatalogo';
import { useAccionesCatalogo, type TextosCatalogo } from './useAccionesCatalogo';

interface Opciones<T> {
    /** Qué pasa al dar de baja y al reactivar. Cada pantalla dice el suyo: no hay valor por omisión. */
    textos: TextosCatalogo;
    /** Textos donde busca el buscador; por omisión, el nombre. Debe ser una función estable (de módulo). */
    buscarEn?: (registro: T) => string[];
    /** Se llama después de guardar o de cambiar el estado, para quien depende de este catálogo. */
    alCambiar?: () => void;
}

const buscarEnNombre = (registro: RegistroCatalogo): string[] => [registro.nombre];

/**
 * Pantalla de un catálogo corto con baja lógica: carga completa (activas y de
 * baja), filtro de estado y búsqueda en memoria, y las acciones sobre un
 * registro (`useAccionesCatalogo`). Es la misma para todos los catálogos de
 * Facturación salvo clientes, que pagina en el servidor; lo que cambia de una
 * pantalla a otra es solo cómo se dibujan las filas.
 *
 * El servidor no filtra ni pagina estos catálogos (son cortos): el filtro de
 * estado y la búsqueda se resuelven aquí. Las bajas importan porque un `unique`
 * del nombre también las cuenta: un nombre "libre" en pantalla puede dar 422 por
 * una fila de baja.
 */
export function useCatalogo<T extends RegistroCatalogo, D>(api: ApiCatalogo<T, D>, { textos, buscarEn = buscarEnNombre, alCambiar }: Opciones<T>) {
    const [registros, setRegistros] = useState<T[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [estado, setEstado] = useState<FiltroEstado>('activas');
    const [busqueda, setBusqueda] = useState('');

    const peticionRef = useRef(0);
    const alCambiarRef = useRef(alCambiar);

    useEffect(() => {
        alCambiarRef.current = alCambiar;
    }, [alCambiar]);

    const recargar = useCallback(async () => {
        const numero = ++peticionRef.current;
        setCargando(true);

        try {
            const lista = await api.listar();
            // Una respuesta vieja no pisa la de una recarga posterior.
            if (numero !== peticionRef.current) return;

            setRegistros(lista);
            setError(null);
        } catch (e) {
            if (numero !== peticionRef.current) return;
            setRegistros([]);
            setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo.');
        } finally {
            if (numero === peticionRef.current) setCargando(false);
        }
    }, [api]);

    useEffect(() => {
        recargar();
    }, [recargar]);

    const acciones = useAccionesCatalogo(api, {
        textos,
        // Tras un cambio: refresca la lista y avisa a quien dependa de ella.
        alTerminar: async () => {
            await recargar();
            alCambiarRef.current?.();
        },
    });

    const visibles = useMemo(() => {
        const texto = normalizarBusqueda(busqueda);

        return registros.filter(r => {
            if (estado === 'activas' && r.status !== 'A') return false;
            if (estado === 'baja' && r.status !== 'N') return false;

            return texto === '' || buscarEn(r).some(campo => normalizarBusqueda(campo).includes(texto));
        });
    }, [registros, estado, busqueda, buscarEn]);

    /** Desde el aviso de nombre repetido: muestra todas las filas filtradas por ese nombre. */
    const buscarNombre = (nombre: string) => {
        setEstado('todas');
        setBusqueda(nombre);
        acciones.setModal(null);
    };

    return { registros, visibles, cargando, error, recargar, estado, setEstado, busqueda, setBusqueda, buscarNombre, ...acciones };
}

/** Lo que devuelve `useCatalogo`: para pasar un catálogo ya cargado a un componente hijo. */
export type EstadoCatalogo<T extends RegistroCatalogo, D> = ReturnType<typeof useCatalogo<T, D>>;
