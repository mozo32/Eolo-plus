import { obtenerInfoMatriculaApi } from '@/stores/apiWalkaround';
import { useCallback, useState } from 'react';
import Swal from 'sweetalert2';

/**
 * Consulta de matrícula centralizada para Operaciones Programadas.
 *
 * Usa la misma fuente que Operaciones Diarias y WalkAround (catálogo remoto de
 * matrículas) y muestra la misma advertencia que WalkAround cuando la matrícula
 * no existe. Programar no da de alta la matrícula: eso sigue ocurriendo solo al
 * finalizar el registro real.
 */
export function useMatriculaProgramada() {
    const [consultando, setConsultando] = useState(false);

    /** Devuelve el equipo registrado para la matrícula, o null si no existe. */
    const consultarEquipo = useCallback(async (matricula: string): Promise<string | null> => {
        const valor = matricula.trim().toUpperCase();

        if (valor.length < 3) return null;

        setConsultando(true);
        try {
            const info = await obtenerInfoMatriculaApi(valor);
            return info?.tipo ? String(info.tipo).toUpperCase() : null;
        } catch {
            return null;
        } finally {
            setConsultando(false);
        }
    }, []);

    /**
     * Confirma que se puede continuar con la matrícula capturada.
     * Si no existe en el catálogo, pide confirmación explícita.
     */
    const confirmarMatricula = useCallback(async (matricula: string): Promise<boolean> => {
        const valor = matricula.trim().toUpperCase();

        setConsultando(true);
        let existe = false;

        try {
            const info = await obtenerInfoMatriculaApi(valor);
            existe = Boolean(info?.tipo);
        } catch {
            existe = false;
        } finally {
            setConsultando(false);
        }

        if (existe) return true;

        const respuesta = await Swal.fire({
            title: 'No encontrado',
            text: `La matrícula "${valor}" no existe. ¿Continuar?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, continuar',
        });

        return respuesta.isConfirmed;
    }, []);

    return { consultando, consultarEquipo, confirmarMatricula };
}
