import { CircleCheck, Clock3, X } from 'lucide-react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import { fechaCorta, fechaHoraLocal, formatearHoras, horasAHHMM, horasTranscurridas, type EntregaPayload, type Prestamo } from './types';

interface Props {
    prestamo: Prestamo;
    onCerrar: () => void;
    /** Devuelve true si el préstamo quedó cerrado (o ya lo estaba); el modal se cierra en ese caso. */
    onGuardar: (payload: EntregaPayload) => Promise<boolean>;
}

const CAMPO =
    'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500';
const ETIQUETA = 'mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-500';
const ERROR = 'mt-1 text-[10px] font-bold text-red-600';
const MENSAJE_MENOR = 'El horómetro final no puede ser menor que el horómetro inicial.';

/**
 * Entrega de la GPU.
 *
 * El tiempo de uso es tiempo de reloj: las horas transcurridas desde que se
 * registró el préstamo hasta que se abre esta ventana. Se coloca ya calculado y
 * el usuario puede ajustarlo antes de guardar. Los horómetros son la lectura de
 * la planta y no intervienen en ese cálculo. HH:MM es solo una ayuda visual.
 */
export default function EntregaModal({ prestamo, onCerrar, onGuardar }: Props) {
    const inicio = Number(prestamo.horometro_inicio);
    const [fin, setFin] = useState('');
    // Se congela al abrir: es el tiempo que el usuario ve y el que se guarda.
    const [transcurrido] = useState(() => horasTranscurridas(prestamo.created_at));
    const [tiempo, setTiempo] = useState(() => (transcurrido === null ? '' : transcurrido.toFixed(2)));
    const [guardando, setGuardando] = useState(false);

    const finNumero = fin === '' ? null : Number(fin);
    const finInvalido = finNumero !== null && (!Number.isFinite(finNumero) || finNumero < 0);
    const finMenor = finNumero !== null && !finInvalido && finNumero < inicio;
    const tiempoNumero = tiempo === '' ? null : Number(tiempo);
    const tiempoInvalido = tiempoNumero !== null && (!Number.isFinite(tiempoNumero) || tiempoNumero < 0);

    const puedeGuardar = finNumero !== null && !finInvalido && !finMenor && !tiempoInvalido && !guardando;

    const enviar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!puedeGuardar || finNumero === null) return;

        const horasFinales = tiempoNumero ?? transcurrido;

        const confirmacion = await Swal.fire({
            title: 'Registrar entrega',
            text: `Se cerrará el préstamo de la matrícula ${prestamo.matricula} con horómetro final ${finNumero.toFixed(2)} y ${formatearHoras(horasFinales)} h de uso (${horasAHHMM(horasFinales)}).`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, registrar',
            cancelButtonText: 'Regresar',
            confirmButtonColor: '#d97706',
            reverseButtons: true,
        });

        if (!confirmacion.isConfirmed) return;

        setGuardando(true);
        const ok = await onGuardar({
            horometro_fin: Math.round(finNumero * 100) / 100,
            tiempo: tiempoNumero === null ? null : Math.round(tiempoNumero * 100) / 100,
        });
        setGuardando(false);

        if (ok) onCerrar();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onCerrar} />
            <form
                onSubmit={enviar}
                className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
            >
                <header className="flex items-center justify-between border-b border-slate-100 bg-amber-50 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <span className="rounded-xl bg-amber-100 p-2 text-amber-600">
                            <CircleCheck size={20} />
                        </span>
                        <div>
                            <h3 className="text-base font-black uppercase tracking-tight text-slate-800">Registrar entrega</h3>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                {prestamo.matricula} · {prestamo.empresa} · {fechaCorta(prestamo.fecha)}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onCerrar} className="text-slate-400 hover:text-slate-600">
                        <X size={18} />
                    </button>
                </header>

                <div className="space-y-4 p-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className={ETIQUETA}>Horómetro inicial</label>
                            <input
                                type="text"
                                value={formatearHoras(prestamo.horometro_inicio)}
                                readOnly
                                className={`${CAMPO} bg-slate-100 text-slate-500`}
                            />
                            <p className="mt-1 text-[10px] font-semibold text-slate-400">Solo referencia, no se modifica.</p>
                        </div>
                        <div>
                            <label className={ETIQUETA}>Horómetro final</label>
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                value={fin}
                                onChange={e => setFin(e.target.value)}
                                placeholder={formatearHoras(inicio)}
                                className={`${CAMPO} ${finMenor || finInvalido ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
                                autoFocus
                                required
                            />
                            {finMenor && <p className={ERROR}>{MENSAJE_MENOR}</p>}
                            {finInvalido && <p className={ERROR}>El horómetro final no puede ser negativo.</p>}
                        </div>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                        <label className={ETIQUETA}>Tiempo de uso (horas decimales)</label>
                        <p className="mb-2 text-[11px] font-semibold text-slate-500">
                            Préstamo registrado: {fechaHoraLocal(prestamo.created_at)}
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                value={tiempo}
                                onChange={e => setTiempo(e.target.value)}
                                placeholder="0.00"
                                className={`${CAMPO} sm:max-w-[160px] ${tiempoInvalido ? 'border-red-400' : ''}`}
                            />
                            <div className="flex items-center gap-2 text-slate-600">
                                <Clock3 size={16} className="text-amber-600" />
                                <span className="text-sm font-black">
                                    {tiempoNumero === null || tiempoInvalido ? '—' : `${tiempoNumero.toFixed(2)} h`}
                                </span>
                                <span className="text-sm font-semibold text-slate-400">≈ {horasAHHMM(tiempoNumero)}</span>
                            </div>
                        </div>
                        <p className="mt-2 text-[10px] font-semibold text-slate-500">
                            Tiempo transcurrido desde que se registró el préstamo. Puedes ajustarlo antes de guardar. Horas decimales: 0.50 h = 30 min,
                            no 50 min.
                        </p>
                        {tiempoInvalido && <p className={ERROR}>El tiempo de uso no puede ser negativo.</p>}
                    </div>
                </div>

                <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                    <button
                        type="button"
                        onClick={onCerrar}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase text-slate-600 hover:bg-slate-100"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={!puedeGuardar}
                        className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold uppercase text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {guardando ? 'Guardando…' : 'Registrar entrega'}
                    </button>
                </footer>
            </form>
        </div>
    );
}
