import { obtenerCoincidenciasProgramadasApi } from '@/stores/apiOperacionesProgramadas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmarHoraFutura, elegirEntreVarias, preguntarUnaCoincidencia } from './coincidenciasProgramadas';
import {
    esMatriculaCompleta,
    normalizarMatricula,
    precargaDesde,
    type ModuloConsumidor,
    type OperacionProgramada,
    type PrecargaProgramada,
} from './types';

const MS_DEBOUNCE = 500;

type Decision = 'cargada' | 'manual';

interface Opciones {
    modulo: ModuloConsumidor;
    /** Movimiento del formulario. En WalkAround puede venir vacío hasta que eligen el radio. */
    tipo: string;
    matricula: string;
    fecha: string;
    /** Apagado en modo edición: solo se detecta en registros nuevos. */
    activo: boolean;
    /** Id de la programada vinculada hoy a esta pestaña (viene del padre). */
    vinculadaId: number | null;
    /**
     * El formulario pide al padre vincular. El padre devuelve false si otra
     * pestaña ya tiene esa programación; entonces no se carga nada.
     */
    onVincular: (precarga: PrecargaProgramada, operacion: OperacionProgramada) => boolean | Promise<boolean>;
    /** La pestaña deja de estar vinculada: cambió la matrícula, el tipo o la fecha. */
    onDesvincular: () => void;
    /** El usuario decidió seguir con un registro imprevisto. */
    onContinuarManual?: () => void;
}

/**
 * Detecta si la matrícula que el usuario captura a mano tiene una operación
 * programada para hoy del mismo tipo, y ofrece cargarla.
 *
 * Es el mismo hook para Operaciones Diarias y WalkAround. No toca el estado del
 * formulario: resuelve a través de onVincular y onDesvincular, porque el dueño
 * del vínculo entre pestaña y programación sigue siendo el padre.
 */
export function useDeteccionProgramada(opciones: Opciones) {
    const [avisoOtroTipo, setAvisoOtroTipo] = useState<string | null>(null);
    const [buscando, setBuscando] = useState(false);

    const opcionesRef = useRef(opciones);
    opcionesRef.current = opciones;

    /** Qué decidió el usuario para cada combinación matrícula|tipo|fecha. */
    const decisionesRef = useRef(new Map<string, Decision>());
    /** Combinaciones ya consultadas sin coincidencias: no se vuelven a pedir. */
    const sinCoincidenciasRef = useRef(new Set<string>());
    /** Clave con la que se hizo el vínculo vigente, para detectar cuándo deja de coincidir. */
    const claveVinculoRef = useRef<string | null>(null);
    const vinculadaAnteriorRef = useRef<number | null>(null);
    const consultandoRef = useRef(false);
    const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clave = `${normalizarMatricula(opciones.matricula)}|${opciones.tipo.toLowerCase()}|${opciones.fecha}`;
    const listaParaConsultar =
        opciones.activo && opciones.tipo !== '' && opciones.fecha !== '' && esMatriculaCompleta(opciones.matricula);

    // Cuando el padre vincula (por el botón o por esta detección), se registra la
    // clave con la que quedó vinculada. Si el usuario luego cambia matrícula,
    // tipo o fecha, la clave deja de coincidir y se suelta el vínculo.
    useEffect(() => {
        const vinculada = opciones.vinculadaId;

        if (vinculada && vinculada !== vinculadaAnteriorRef.current) {
            claveVinculoRef.current = clave;
            decisionesRef.current.set(clave, 'cargada');
        }

        if (!vinculada) {
            claveVinculoRef.current = null;
        }

        vinculadaAnteriorRef.current = vinculada;
    }, [opciones.vinculadaId, clave]);

    useEffect(() => {
        if (!opciones.vinculadaId || !claveVinculoRef.current) return;
        if (claveVinculoRef.current === clave) return;

        // Nunca sobrevive un id que ya no corresponde a lo que dice el formulario.
        claveVinculoRef.current = null;
        opcionesRef.current.onDesvincular();
    }, [clave, opciones.vinculadaId]);

    const buscar = useCallback(async () => {
        const o = opcionesRef.current;
        const matricula = normalizarMatricula(o.matricula);
        const claveActual = `${matricula}|${o.tipo.toLowerCase()}|${o.fecha}`;

        if (!o.activo || o.tipo === '' || !esMatriculaCompleta(matricula)) return;
        if (decisionesRef.current.has(claveActual)) return;
        if (sinCoincidenciasRef.current.has(claveActual)) return;
        if (consultandoRef.current) return;

        consultandoRef.current = true;
        setBuscando(true);

        try {
            const { coincidencias, del_otro_tipo } = await obtenerCoincidenciasProgramadasApi({
                matricula,
                tipo: o.tipo,
                modulo: o.modulo,
                fecha: o.fecha,
            });

            // Si mientras esperábamos el usuario cambió algo, este resultado ya no aplica.
            const oAhora = opcionesRef.current;
            const claveAhora = `${normalizarMatricula(oAhora.matricula)}|${oAhora.tipo.toLowerCase()}|${oAhora.fecha}`;
            if (claveAhora !== claveActual) return;

            if (coincidencias.length === 0) {
                // Blur, Enter o el debounce de la misma matrícula ya no repiten
                // la petición mientras no cambien matrícula, tipo o fecha.
                sinCoincidenciasRef.current.add(claveActual);
                setAvisoOtroTipo(
                    del_otro_tipo > 0
                        ? `Hay ${del_otro_tipo === 1 ? 'una operación programada' : `${del_otro_tipo} operaciones programadas`} de ${
                              o.tipo.toLowerCase() === 'salida' ? 'llegada' : 'salida'
                          } para esta matrícula hoy. No se carga porque el movimiento es distinto.`
                        : null,
                );
                return;
            }

            setAvisoOtroTipo(null);

            const elegida =
                coincidencias.length === 1
                    ? await preguntarUnaCoincidencia(coincidencias[0])
                    : await elegirEntreVarias(coincidencias);

            if (!elegida) {
                decisionesRef.current.set(claveActual, 'manual');
                oAhora.onContinuarManual?.();
                return;
            }

            if (!(await confirmarHoraFutura(elegida))) {
                decisionesRef.current.set(claveActual, 'manual');
                oAhora.onContinuarManual?.();
                return;
            }

            const vinculada = await oAhora.onVincular(precargaDesde(elegida), elegida);

            // Si otra pestaña ya la tenía, el padre avisó y cambió el foco. Se
            // anota para no volver a preguntar por la misma combinación.
            decisionesRef.current.set(claveActual, vinculada ? 'cargada' : 'manual');
            if (vinculada) claveVinculoRef.current = claveActual;
        } catch {
            // Un fallo de red no debe estorbar la captura manual.
        } finally {
            consultandoRef.current = false;
            setBuscando(false);
        }
    }, []);

    // Debounce sobre matrícula, tipo y fecha.
    useEffect(() => {
        if (temporizadorRef.current) clearTimeout(temporizadorRef.current);

        if (!listaParaConsultar) {
            setAvisoOtroTipo(null);
            return;
        }

        temporizadorRef.current = setTimeout(() => {
            temporizadorRef.current = null;
            buscar();
        }, MS_DEBOUNCE);

        return () => {
            if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
        };
    }, [clave, listaParaConsultar, buscar]);

    /** Consulta sin esperar el debounce: al elegir una sugerencia o al perder el foco. */
    const buscarAhora = useCallback(() => {
        if (temporizadorRef.current) {
            clearTimeout(temporizadorRef.current);
            temporizadorRef.current = null;
        }

        buscar();
    }, [buscar]);

    return { buscarAhora, avisoOtroTipo, buscando };
}
