import InputMatricula from '@/pages/InputMatricula';
import {
    ErrorApi,
    guardarOperacionProgramadaApi,
    validarMovimientoProgramadoApi,
} from '@/stores/apiOperacionesProgramadas';
import { CalendarClock, Loader2, ShieldBan, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { useMatriculaProgramada } from './useMatriculaProgramada';
import {
    formularioAPayload,
    formularioDesde,
    formularioVacio,
    horaValida,
    type OperacionProgramada,
    type OperacionProgramadaForm,
    type TipoOperacion,
} from './types';

interface Props {
    fecha: string;
    operacion?: OperacionProgramada | null;
    onCerrar: () => void;
    onGuardado: () => void;
}

const label = 'mb-1.5 block text-[11px] font-semibold tracking-wider text-slate-500';
const input =
    'w-full rounded-lg border border-slate-200 p-2.5 text-sm font-medium text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-300 focus:border-[#00677F] focus:ring-1 focus:ring-[#00677F]';

/**
 * Mismo modal para programar y para actualizar: si recibe `operacion` carga sus
 * datos, si no arranca en blanco con la fecha consultada.
 */
export default function OperacionProgramadaModal({ fecha, operacion, onCerrar, onGuardado }: Props) {
    const esEdicion = Boolean(operacion);

    const [form, setForm] = useState<OperacionProgramadaForm>(() =>
        operacion ? formularioDesde(operacion) : formularioVacio(fecha),
    );
    const [guardando, setGuardando] = useState(false);
    const [avisoRestriccion, setAvisoRestriccion] = useState<string | null>(null);
    const [matriculaConfirmada, setMatriculaConfirmada] = useState<string>(
        operacion ? operacion.matricula : '',
    );

    const { consultando, consultarEquipo, confirmarMatricula } = useMatriculaProgramada();
    const ultimaMatriculaConsultada = useRef<string>(operacion?.matricula ?? '');

    const esSalida = form.tipo === 'salida';
    const horaConError = form.hora.length > 0 && !horaValida(form.hora);

    const actualizar = (cambios: Partial<OperacionProgramadaForm>) =>
        setForm(previo => ({ ...previo, ...cambios }));

    /**
     * Captura manual de la hora en formato de 24 horas. Solo admite dígitos y
     * coloca los dos puntos sola: 0830 queda como 08:30. No hay AM/PM.
     */
    const cambiarHora = (valor: string) => {
        const digitos = valor.replace(/\D/g, '').slice(0, 4);

        actualizar({
            hora: digitos.length >= 3 ? `${digitos.slice(0, 2)}:${digitos.slice(2)}` : digitos,
        });
    };

    // Autocompleta el equipo desde el catálogo de matrículas, igual que hacen
    // Operaciones Diarias y WalkAround.
    useEffect(() => {
        const matricula = form.matricula.trim().toUpperCase();

        if (matricula.length < 4 || matricula === ultimaMatriculaConsultada.current) return;

        const temporizador = setTimeout(async () => {
            ultimaMatriculaConsultada.current = matricula;
            const equipo = await consultarEquipo(matricula);

            if (equipo) {
                actualizar({ equipo });
                setMatriculaConfirmada(matricula);
            }
        }, 400);

        return () => clearTimeout(temporizador);
    }, [form.matricula, consultarEquipo]);

    // Aviso anticipado de restricción. La validación que manda es la del backend.
    const claveConsulta = useMemo(
        () => `${form.matricula}|${form.tipo}|${form.fecha}|${form.hora}`,
        [form.matricula, form.tipo, form.fecha, form.hora],
    );

    useEffect(() => {
        const matricula = form.matricula.trim().toUpperCase();

        if (matricula.length < 4 || !form.fecha || !horaValida(form.hora)) {
            setAvisoRestriccion(null);
            return;
        }

        let cancelado = false;

        const temporizador = setTimeout(async () => {
            try {
                const resultado = await validarMovimientoProgramadoApi({
                    matricula,
                    tipo: form.tipo,
                    fecha: form.fecha,
                    hora: form.hora,
                    id: form.id,
                });

                if (!cancelado) {
                    setAvisoRestriccion(
                        resultado.restriccion?.restringido ? resultado.restriccion.message : null,
                    );
                }
            } catch {
                if (!cancelado) setAvisoRestriccion(null);
            }
        }, 500);

        return () => {
            cancelado = true;
            clearTimeout(temporizador);
        };
    }, [claveConsulta, form.fecha, form.hora, form.id, form.matricula, form.tipo]);

    const cambiarTipo = (tipo: TipoOperacion) =>
        actualizar({ tipo, lugar: '', fp: '' });

    const validarLocal = (): string | null => {
        if (!form.fecha) return 'Selecciona la fecha de la operación.';
        if (form.matricula.trim().length < 3) return 'Captura la matrícula.';
        if (form.equipo.trim() === '') return 'Captura el equipo.';
        if (!horaValida(form.hora)) {
            return 'Captura la hora en formato de 24 horas HH:mm, por ejemplo 08:30, 16:45 o 23:10.';
        }
        if (form.pax !== '' && Number(form.pax) < 0) return 'El número de PAX no puede ser negativo.';
        return null;
    };

    const enviar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (guardando) return;

        const errorLocal = validarLocal();
        if (errorLocal) {
            Swal.fire({ icon: 'warning', title: 'Faltan datos', text: errorLocal });
            return;
        }

        const matricula = form.matricula.trim().toUpperCase();

        // Misma advertencia que WalkAround: solo continúa si el usuario confirma.
        if (matricula !== matriculaConfirmada) {
            const continuar = await confirmarMatricula(matricula);
            if (!continuar) return;
            setMatriculaConfirmada(matricula);
        }

        setGuardando(true);
        try {
            await guardarOperacionProgramadaApi(formularioAPayload(form));

            Swal.fire({
                icon: 'success',
                title: esEdicion ? 'Operación actualizada' : 'Operación programada',
                timer: 1600,
                showConfirmButton: false,
            });

            onGuardado();
        } catch (error) {
            if (error instanceof ErrorApi && error.codigo === 'movimiento_restringido') {
                // El formulario y el modal se quedan abiertos para que el usuario
                // corrija la matrícula o el tipo de operación.
                setAvisoRestriccion(error.message);

                Swal.fire({
                    icon: 'error',
                    title: 'Movimiento restringido',
                    text: error.message,
                    confirmButtonText: 'Entendido',
                });

                return;
            }

            Swal.fire({
                icon: 'error',
                title: 'No se pudo guardar',
                text: error instanceof Error ? error.message : 'Error al guardar la operación',
            });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md">
            <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                <button
                    type="button"
                    onClick={onCerrar}
                    className="absolute right-4 top-4 z-10 rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-red-100 hover:text-red-600"
                >
                    <X size={20} />
                </button>

                <form onSubmit={enviar} className="space-y-6 p-6">
                    <header className="border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-[#00677F]/10 p-2 text-[#00677F]">
                                <CalendarClock size={20} />
                            </span>
                            <div>
                                <h2 className="text-lg font-extrabold uppercase text-slate-800">
                                    {esEdicion ? 'Actualizar operación' : 'Programar operación'}
                                </h2>
                                <p className="text-xs font-semibold uppercase text-slate-400">Área de Despacho</p>
                            </div>
                        </div>
                    </header>

                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-5">
                        <span className={label}>Tipo de operación</span>
                        <div className="flex flex-wrap gap-6">
                            {(['llegada', 'salida'] as TipoOperacion[]).map(opcion => (
                                <label key={opcion} className="flex cursor-pointer items-center gap-3">
                                    <input
                                        type="radio"
                                        name="tipo"
                                        checked={form.tipo === opcion}
                                        onChange={() => cambiarTipo(opcion)}
                                        className="h-5 w-5 cursor-pointer border-slate-300 text-[#00677F] focus:ring-[#00677F]"
                                    />
                                    <span
                                        className={`text-sm font-bold ${
                                            form.tipo === opcion ? 'text-[#00677F]' : 'text-slate-500'
                                        }`}
                                    >
                                        {opcion === 'llegada' ? 'Llegada' : 'Salida'}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <div>
                            <label className={label}>Fecha de la operación</label>
                            <input
                                type="date"
                                value={form.fecha}
                                onChange={e => actualizar({ fecha: e.target.value })}
                                className={input}
                            />
                        </div>

                        <div className="relative">
                            <div className="flex items-center justify-between">
                                <label className={label}>Matrícula</label>
                                {consultando && <Loader2 className="mb-1.5 animate-spin text-slate-300" size={14} />}
                            </div>
                            <InputMatricula
                                value={form.matricula}
                                onSelect={valor => actualizar({ matricula: valor.toUpperCase() })}
                            />
                        </div>

                        <div>
                            <label className={label}>Equipo</label>
                            <input
                                type="text"
                                value={form.equipo}
                                onChange={e => actualizar({ equipo: e.target.value.replace(/\s/g, '').toUpperCase() })}
                                placeholder="Ej. C172"
                                className={input}
                            />
                        </div>

                        <div>
                            <label className={label}>Hora (24 horas)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={form.hora}
                                    onChange={e => cambiarHora(e.target.value)}
                                    placeholder="HH:mm"
                                    maxLength={5}
                                    className={`${input} ${horaConError ? 'border-red-400 focus:border-red-500 focus:ring-red-200' : ''}`}
                                />
                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                    hrs
                                </span>
                            </div>
                            <p className={`mt-1 text-[10px] font-medium ${horaConError ? 'text-red-500' : 'text-slate-400'}`}>
                                {horaConError
                                    ? 'Formato inválido. Usa HH:mm entre 00:00 y 23:59.'
                                    : 'Formato de 24 horas. Ejemplos: 08:30, 16:45, 23:10.'}
                            </p>
                        </div>

                        <div>
                            <label className={label}>{esSalida ? 'Destino' : 'Origen'}</label>
                            <input
                                type="text"
                                value={form.lugar}
                                onChange={e => actualizar({ lugar: e.target.value.toUpperCase() })}
                                placeholder={esSalida ? 'Lugar de destino' : 'Lugar de origen'}
                                className={input}
                            />
                        </div>

                        <div>
                            <label className={label}>PAX</label>
                            <input
                                type="number"
                                min={0}
                                value={form.pax}
                                onChange={e => actualizar({ pax: e.target.value })}
                                placeholder="0"
                                className={input}
                            />
                        </div>

                        {esSalida && (
                            <div>
                                <label className={label}>FP (Plan de vuelo)</label>
                                <input
                                    type="text"
                                    value={form.fp}
                                    onChange={e => actualizar({ fp: e.target.value })}
                                    placeholder="Opcional"
                                    className={input}
                                />
                            </div>
                        )}

                        <div className="md:col-span-2">
                            <label className={label}>Observaciones</label>
                            <textarea
                                rows={3}
                                value={form.observaciones}
                                onChange={e => actualizar({ observaciones: e.target.value })}
                                placeholder="Notas para la operación programada"
                                className={`${input} resize-none`}
                            />
                        </div>
                    </div>

                    {avisoRestriccion && (
                        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                            <ShieldBan className="mt-0.5 shrink-0 text-red-500" size={18} />
                            <p className="text-sm font-medium text-red-800">{avisoRestriccion}</p>
                        </div>
                    )}

                    <footer className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                        <button
                            type="button"
                            onClick={onCerrar}
                            className="rounded-lg px-6 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={guardando}
                            className="flex items-center gap-2 rounded-lg bg-[#00677F] px-8 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#00586D] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {guardando && <Loader2 className="animate-spin" size={16} />}
                            {esEdicion ? 'Actualizar' : 'Programar'}
                        </button>
                    </footer>
                </form>
            </div>
        </div>
    );
}
