import { obtenerNombresHistoricosApi } from '@/stores/apiOperacionesDiarias';
import { esMatriculaCompleta, normalizarMatricula } from '@/pages/despacho/operacionesProgramadas/types';
import { useCallback, useEffect, useRef, useState } from 'react';

const MS_DEBOUNCE = 400;

interface Opciones {
    /**
     * Se avisa cuando llegan responsables de una matrícula distinta a la
     * anterior, para que el formulario limpie un nombre que ya no corresponde.
     */
    alCambiarDeMatricula?: (nuevosNombres: string[]) => void;
}

/**
 * Responsables (nombres históricos) de la matrícula que tiene el formulario.
 *
 * Observa la matrícula efectiva del estado, así que da igual cómo llegó:
 * tecleada, elegida del autocompletado, precargada desde una operación
 * programada o restaurada de la caché de la pestaña. No conoce la detección de
 * programadas ni toca el formulario: solo devuelve la lista.
 *
 * - Debounce para el tecleo; nunca una petición por tecla.
 * - Matrícula vacía o incompleta → lista vacía sin consultar.
 * - Caché por matrícula: la misma no se vuelve a pedir.
 * - Una respuesta vieja no pisa la de la matrícula vigente.
 */
export function useResponsablesPorMatricula(matricula: string, opciones: Opciones = {}) {
    const [sugerenciasNombres, setSugerenciasNombres] = useState<string[]>([]);
    const [cargandoNombres, setCargandoNombres] = useState(false);

    const opcionesRef = useRef(opciones);
    opcionesRef.current = opciones;

    const cacheRef = useRef(new Map<string, string[]>());
    /** Matrícula cuyos nombres están hoy en pantalla (o en camino). */
    const matriculaVigenteRef = useRef<string>('');
    const peticionRef = useRef(0);
    /** Matrícula con una petición en vuelo: el debounce no la vuelve a pedir. */
    const enVueloRef = useRef<string | null>(null);
    const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clave = normalizarMatricula(matricula);
    const consultable = clave !== '' && esMatriculaCompleta(clave);

    const aplicar = useCallback((clave: string, nombres: string[]) => {
        const cambioDeMatricula = matriculaVigenteRef.current !== clave;
        matriculaVigenteRef.current = clave;
        setSugerenciasNombres(nombres);

        if (cambioDeMatricula) opcionesRef.current.alCambiarDeMatricula?.(nombres);
    }, []);

    const consultar = useCallback(
        async (clave: string, forzar = false) => {
            if (!forzar && cacheRef.current.has(clave)) {
                aplicar(clave, cacheRef.current.get(clave) ?? []);
                return;
            }

            const numero = ++peticionRef.current;
            enVueloRef.current = clave;
            setCargandoNombres(true);

            try {
                const nombres = await obtenerNombresHistoricosApi(clave);
                const lista = Array.isArray(nombres) ? nombres.map(String) : [];

                cacheRef.current.set(clave, lista);

                // Si mientras esperábamos cambió la matrícula, esta respuesta ya no aplica.
                if (numero !== peticionRef.current) return;

                aplicar(clave, lista);
            } catch (error) {
                console.error('No se pudieron cargar los responsables de la matrícula', error);
                if (numero === peticionRef.current) aplicar(clave, []);
            } finally {
                if (numero === peticionRef.current) {
                    enVueloRef.current = null;
                    setCargandoNombres(false);
                }
            }
        },
        [aplicar],
    );

    useEffect(() => {
        if (temporizadorRef.current) clearTimeout(temporizadorRef.current);

        if (!consultable) {
            // Invalida cualquier petición en vuelo y deja la lista vacía.
            peticionRef.current++;
            enVueloRef.current = null;
            setCargandoNombres(false);
            if (matriculaVigenteRef.current !== '') aplicar('', []);
            return;
        }

        // Ya en pantalla, o ya pedida (por ejemplo, por recargarResponsables).
        if (matriculaVigenteRef.current === clave || enVueloRef.current === clave) return;

        // Ya consultada: se muestra al instante, sin esperar el debounce.
        if (cacheRef.current.has(clave)) {
            aplicar(clave, cacheRef.current.get(clave) ?? []);
            return;
        }

        temporizadorRef.current = setTimeout(() => {
            temporizadorRef.current = null;
            consultar(clave);
        }, MS_DEBOUNCE);

        return () => {
            if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
        };
    }, [clave, consultable, aplicar, consultar]);

    /**
     * Consulta de inmediato, sin debounce ni caché. Para la precarga de una
     * operación programada: recibe la matrícula del objeto, no la del estado,
     * porque el setState todavía no se ha aplicado.
     */
    const recargarResponsables = useCallback(
        (matriculaDirecta: string) => {
            const claveDirecta = normalizarMatricula(matriculaDirecta);

            if (temporizadorRef.current) {
                clearTimeout(temporizadorRef.current);
                temporizadorRef.current = null;
            }

            if (claveDirecta === '' || !esMatriculaCompleta(claveDirecta)) return;

            consultar(claveDirecta, true);
        },
        [consultar],
    );

    return { sugerenciasNombres, cargandoNombres, recargarResponsables };
}
