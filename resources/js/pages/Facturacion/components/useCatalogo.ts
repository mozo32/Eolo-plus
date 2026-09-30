import { ErrorApi, type ApiCatalogo } from '@/stores/apiFacturacionCatalogos';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { toast } from './estilos';
import { normalizarBusqueda } from './formato';
import type { RegistroCatalogo } from './ModalCatalogo';

export type FiltroEstado = 'activas' | 'baja' | 'todas';

/** Lo que dicen los avisos de baja y de reactivación; cada catálogo explica sus propias consecuencias. */
export interface TextosCatalogo {
    baja: string;
    reactivar: string;
}

export const TEXTOS_CATALOGO_POR_OMISION: TextosCatalogo = {
    baja: 'Ya no se podrá elegir en registros nuevos; lo que ya lo usa no cambia. Podrás reactivarlo desde el filtro "De baja".',
    reactivar: 'Volverá a poder elegirse en registros nuevos.',
};

interface Opciones<T> {
    textos?: TextosCatalogo;
    /** Textos donde busca el buscador; por omisión, el nombre. Debe ser una función estable (de módulo). */
    buscarEn?: (registro: T) => string[];
    /** Se llama después de guardar o de cambiar el estado, para quien depende de este catálogo. */
    alCambiar?: () => void;
}

const buscarEnNombre = (registro: RegistroCatalogo): string[] => [registro.nombre];

/**
 * Lógica de una pantalla de catálogo con baja lógica: carga completa (activas y
 * de baja), filtro de estado y búsqueda, alta/edición en modal, baja y
 * reactivación con confirmación, y recuperación del 409 (otra persona ya había
 * cambiado el estado). Es la misma para todos los catálogos de Facturación; lo
 * que cambia de una pantalla a otra es solo cómo se dibujan las filas.
 *
 * El servidor no filtra ni pagina estos catálogos (son cortos): el filtro de
 * estado y la búsqueda se resuelven aquí. Las bajas importan porque un `unique`
 * del nombre también las cuenta: un nombre "libre" en pantalla puede dar 422 por
 * una fila de baja.
 */
export function useCatalogo<T extends RegistroCatalogo, D>(api: ApiCatalogo<T, D>, { textos = TEXTOS_CATALOGO_POR_OMISION, buscarEn = buscarEnNombre, alCambiar }: Opciones<T> = {}) {
    const [registros, setRegistros] = useState<T[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [estado, setEstado] = useState<FiltroEstado>('activas');
    const [busqueda, setBusqueda] = useState('');

    /** null: cerrado; `registro: null`: alta. */
    const [modal, setModal] = useState<{ registro: T | null } | null>(null);
    const [accionandoId, setAccionandoId] = useState<number | null>(null);

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

    /** Tras un cambio: refresca la lista y avisa a quien dependa de ella. */
    const refrescarTrasCambio = async () => {
        await recargar();
        alCambiarRef.current?.();
    };

    const visibles = useMemo(() => {
        const texto = normalizarBusqueda(busqueda);

        return registros.filter(r => {
            if (estado === 'activas' && r.status !== 'A') return false;
            if (estado === 'baja' && r.status !== 'N') return false;

            return texto === '' || buscarEn(r).some(campo => normalizarBusqueda(campo).includes(texto));
        });
    }, [registros, estado, busqueda, buscarEn]);

    const guardar = async (datos: D) => {
        const editando = modal?.registro ?? null;
        const respuesta = editando ? await api.actualizar(editando.id, datos) : await api.crear(datos);

        setModal(null);
        toast.fire({ icon: 'success', titleText: respuesta.message });
        await refrescarTrasCambio();
    };

    /** 409: el estado ya era el pedido (otra persona lo cambió). Se avisa y se refresca la lista. */
    const ejecutarCambioDeEstado = async (registro: T, accion: () => Promise<string>, tituloError: string) => {
        if (accionandoId !== null) return;
        setAccionandoId(registro.id);

        try {
            toast.fire({ icon: 'success', titleText: await accion() });
        } catch (e) {
            await Swal.fire({
                icon: e instanceof ErrorApi && e.status === 409 ? 'info' : 'error',
                titleText: tituloError,
                text: e instanceof Error ? e.message : 'Error inesperado',
                confirmButtonColor: '#4f46e5',
            });
        } finally {
            setAccionandoId(null);
            await refrescarTrasCambio();
        }
    };

    const darDeBaja = async (registro: T) => {
        const confirmacion = await Swal.fire({
            // El nombre lo captura un usuario: titleText (texto plano), nunca title, que SweetAlert2 interpreta como HTML.
            titleText: `Dar de baja "${registro.nombre}"`,
            text: textos.baja,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, dar de baja',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc2626',
            reverseButtons: true,
        });

        if (confirmacion.isConfirmed) await ejecutarCambioDeEstado(registro, () => api.desactivar(registro.id), 'No se pudo dar de baja');
    };

    const reactivar = async (registro: T) => {
        const confirmacion = await Swal.fire({
            titleText: `Reactivar "${registro.nombre}"`,
            text: textos.reactivar,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, reactivar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#059669',
            reverseButtons: true,
        });

        if (confirmacion.isConfirmed) await ejecutarCambioDeEstado(registro, () => api.reactivar(registro.id), 'No se pudo reactivar');
    };

    /** Desde el aviso de nombre repetido: muestra todas las filas filtradas por ese nombre. */
    const buscarNombre = (nombre: string) => {
        setEstado('todas');
        setBusqueda(nombre);
        setModal(null);
    };

    return {
        registros,
        visibles,
        cargando,
        error,
        recargar,
        estado,
        setEstado,
        busqueda,
        setBusqueda,
        modal,
        setModal,
        accionandoId,
        guardar,
        darDeBaja,
        reactivar,
        buscarNombre,
    };
}

/** Lo que devuelve `useCatalogo`: para pasar un catálogo ya cargado a un componente hijo. */
export type EstadoCatalogo<T extends RegistroCatalogo, D> = ReturnType<typeof useCatalogo<T, D>>;
