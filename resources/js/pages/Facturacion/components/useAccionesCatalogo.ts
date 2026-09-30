import { ErrorApi, type ApiEscritura } from '@/stores/apiFacturacionCatalogos';
import { useState } from 'react';
import Swal from 'sweetalert2';
import { toast } from './estilos';
import type { RegistroCatalogo } from './ModalCatalogo';

/** Lo que dicen los avisos de baja y de reactivación; cada catálogo explica sus propias consecuencias. */
export interface TextosCatalogo {
    baja: string;
    reactivar: string;
}

interface Opciones {
    textos: TextosCatalogo;
    /** Se llama al terminar cualquier cambio (guardar, baja, reactivación, también si falló): refresca la lista que corresponda. */
    alTerminar: () => Promise<void>;
}

/**
 * Lo que se hace con un registro de un catálogo, sin importar de dónde venga la
 * lista (completa en memoria o paginada del servidor): alta y edición en modal,
 * baja y reactivación con confirmación, y recuperación del 409 (otra persona ya
 * había cambiado el estado). Quien lo usa pone la lista y dice cómo refrescarla.
 */
export function useAccionesCatalogo<T extends RegistroCatalogo, D>(api: ApiEscritura<T, D>, { textos, alTerminar }: Opciones) {
    /** null: cerrado; `registro: null`: alta. */
    const [modal, setModal] = useState<{ registro: T | null } | null>(null);
    const [accionandoId, setAccionandoId] = useState<number | null>(null);

    const guardar = async (datos: D) => {
        const editando = modal?.registro ?? null;
        const respuesta = editando ? await api.actualizar(editando.id, datos) : await api.crear(datos);

        setModal(null);
        toast.fire({ icon: 'success', titleText: respuesta.message });
        await alTerminar();
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
            await alTerminar();
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

    return { modal, setModal, accionandoId, guardar, darDeBaja, reactivar };
}
