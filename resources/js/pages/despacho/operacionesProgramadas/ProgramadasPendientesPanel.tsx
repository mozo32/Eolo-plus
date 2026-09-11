import { obtenerProgramadasPendientesApi } from '@/stores/apiOperacionesProgramadas';
import { CalendarClock, ChevronRight, Clock, Loader2, Plane, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import {
    esHoraFutura,
    fechaHoy,
    precargaDesde,
    type ModuloConsumidor,
    type OperacionProgramada,
    type PrecargaProgramada,
} from './types';

interface Props {
    /** Módulo que consume la programación; el estado de uso es independiente por módulo. */
    modulo: ModuloConsumidor;
    /**
     * Pendientes de hoy que ya trae el padre. Badge y lista comparten esa
     * consulta, así un evento en tiempo real nunca dispara dos peticiones.
     */
    operacionesHoy: OperacionProgramada[];
    cargandoHoy: boolean;
    errorHoy?: string | null;
    onCerrar: () => void;
    onSeleccionar: (precarga: PrecargaProgramada) => void;
}

/**
 * Panel lateral de operaciones programadas pendientes, compartido por
 * Operaciones Diarias y WalkAround. Al elegir una, el módulo abre su propio
 * formulario ya precargado; el registro manual sigue disponible aparte.
 *
 * Arranca en la fecha local de hoy con los datos del padre, que el canal en
 * tiempo real mantiene al día. Si el usuario consulta otra fecha, el panel hace
 * su propia consulta puntual sin afectar el contador del botón.
 */
export default function ProgramadasPendientesPanel({
    modulo,
    operacionesHoy,
    cargandoHoy,
    errorHoy = null,
    onCerrar,
    onSeleccionar,
}: Props) {
    const hoy = fechaHoy();

    const [fechaConsultada, setFechaConsultada] = useState<string>(hoy);
    const [otroDia, setOtroDia] = useState<OperacionProgramada[]>([]);
    const [cargandoOtroDia, setCargandoOtroDia] = useState(false);
    const [errorOtroDia, setErrorOtroDia] = useState<string | null>(null);

    const esHoy = fechaConsultada === hoy;

    const cargarOtroDia = useCallback(
        async (fecha: string) => {
            setCargandoOtroDia(true);
            setErrorOtroDia(null);

            try {
                const data = await obtenerProgramadasPendientesApi({ modulo, fecha });
                setOtroDia(Array.isArray(data) ? data : []);
            } catch (e) {
                setOtroDia([]);
                setErrorOtroDia(
                    e instanceof Error ? e.message : 'No se pudieron cargar las operaciones programadas',
                );
            } finally {
                setCargandoOtroDia(false);
            }
        },
        [modulo],
    );

    useEffect(() => {
        if (esHoy) return;
        cargarOtroDia(fechaConsultada);
    }, [cargarOtroDia, esHoy, fechaConsultada]);

    const operaciones = esHoy ? operacionesHoy : otroDia;
    const cargando = esHoy ? cargandoHoy : cargandoOtroDia;
    const error = esHoy ? errorHoy : errorOtroDia;

    /**
     * La hora programada no filtra la lista: todas las operaciones del día se
     * ofrecen. Solo cuando la hora todavía no llega se pide una confirmación
     * informativa, que el usuario puede aceptar para continuar igualmente.
     */
    const seleccionar = async (operacion: OperacionProgramada) => {
        if (esHoraFutura(operacion.fecha, operacion.hora)) {
            const respuesta = await Swal.fire({
                title: 'Aún no es la hora programada',
                text: `Esta operación está programada para las ${operacion.hora}. Aún no es la hora programada. ¿Deseas continuar de todos modos?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, continuar',
                cancelButtonText: 'Cancelar',
                reverseButtons: true,
            });

            // Al cancelar no se selecciona nada y el formulario queda intacto.
            if (!respuesta.isConfirmed) return;
        }

        onSeleccionar(precargaDesde(operacion));
    };

    return (
        <div className="fixed inset-0 z-[60] flex justify-end overflow-hidden">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onCerrar} />

            <div className="relative flex h-full w-full max-w-md flex-col bg-slate-50 shadow-2xl">
                <div className="border-b border-slate-200 bg-white p-6">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-[#00677F]/10 p-2 text-[#00677F]">
                                <CalendarClock size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Programadas</h3>
                        </div>
                        <button
                            type="button"
                            onClick={onCerrar}
                            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    <p className="mb-3 text-sm text-slate-500">
                        Selecciona una operación programada para iniciar el registro con los datos ya cargados.
                    </p>

                    <label className="block text-[11px] font-semibold tracking-wider text-slate-500">
                        Fecha
                        <input
                            type="date"
                            value={fechaConsultada}
                            onChange={e => setFechaConsultada(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-[#00677F] focus:ring-1 focus:ring-[#00677F]"
                        />
                    </label>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {cargando && (
                        <div className="flex h-64 flex-col items-center justify-center text-slate-400">
                            <Loader2 className="mb-3 animate-spin" size={32} />
                            <p>Cargando programadas…</p>
                        </div>
                    )}

                    {!cargando && error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                            {error}
                        </div>
                    )}

                    {!cargando && !error && operaciones.length === 0 && (
                        <div className="flex h-64 flex-col items-center justify-center text-slate-400">
                            <Plane size={48} className="mb-4 opacity-20" />
                            <p>No hay operaciones programadas pendientes</p>
                        </div>
                    )}

                    {!cargando &&
                        !error &&
                        operaciones.map(operacion => (
                            <button
                                key={operacion.id}
                                type="button"
                                onClick={() => seleccionar(operacion)}
                                className="group w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:border-[#00677F]/40 hover:shadow-md"
                            >
                                <div className="mb-3 flex items-start justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                            Matrícula
                                        </span>
                                        <span className="text-lg font-black tracking-tight text-slate-700">
                                            {operacion.matricula}
                                        </span>
                                    </div>
                                    <span
                                        className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-tighter ${
                                            operacion.tipo === 'llegada'
                                                ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                                                : 'border-red-200 bg-red-100 text-red-700'
                                        }`}
                                    >
                                        {operacion.tipo}
                                    </span>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-slate-600">
                                    <span className="flex items-center gap-1.5">
                                        <Clock size={14} className="text-slate-400" />
                                        {operacion.hora}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Plane size={14} className="text-slate-400" />
                                        <span className="max-w-[120px] truncate">{operacion.equipo}</span>
                                    </span>
                                    <span className="ml-auto flex items-center gap-1 text-[#00677F] transition-transform group-hover:translate-x-1">
                                        <span className="text-[10px] font-bold uppercase opacity-0 transition-opacity group-hover:opacity-100">
                                            Usar
                                        </span>
                                        <ChevronRight size={18} />
                                    </span>
                                </div>

                                {(operacion.lugar || operacion.observaciones) && (
                                    <p className="mt-2 truncate text-xs text-slate-400">
                                        {operacion.lugar}
                                        {operacion.lugar && operacion.observaciones ? ' · ' : ''}
                                        {operacion.observaciones}
                                    </p>
                                )}
                            </button>
                        ))}
                </div>

                <div className="border-t border-slate-200 bg-white p-4">
                    <button
                        type="button"
                        onClick={onCerrar}
                        className="w-full rounded-xl bg-slate-800 py-3 font-bold text-white shadow-lg shadow-slate-200 transition-colors hover:bg-slate-900"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
