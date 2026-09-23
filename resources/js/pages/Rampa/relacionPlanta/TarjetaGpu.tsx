import { BatteryCharging, CircleCheck, Clock3, Plus } from 'lucide-react';
import { EQUIPO_GPU, fechaCorta, formatearHoras, type Prestamo } from './types';

interface Props {
    actual: Prestamo | null;
    cargando: boolean;
    puedeOperar: boolean;
    onPrestar: () => void;
    onEntregar: () => void;
}

/** Tarjeta grande de estado de la GPU N.115: Disponible (esmeralda) o En uso (ámbar). */
export default function TarjetaGpu({ actual, cargando, puedeOperar, onPrestar, onEntregar }: Props) {
    const enUso = actual !== null;

    const marco = enUso
        ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-white'
        : 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-white';
    const icono = enUso ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600';

    const datos: [string, string][] = actual
        ? [
              ['Matrícula', actual.matricula],
              ['Empresa', actual.empresa],
              ['Fecha del préstamo', fechaCorta(actual.fecha)],
              ['Horómetro inicial', `${formatearHoras(actual.horometro_inicio)} h`],
          ]
        : [];

    return (
        <section className={`rounded-2xl border-2 p-5 shadow-sm md:p-6 ${marco}`}>
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="flex items-center gap-4">
                    <span className={`rounded-2xl p-3 ${icono}`}>
                        <BatteryCharging size={36} strokeWidth={2.25} />
                    </span>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Planta de energía</p>
                        <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800 md:text-3xl">{EQUIPO_GPU}</h2>
                    </div>
                </div>

                {cargando ? (
                    <span className="text-[10px] font-black uppercase text-slate-400">Consultando…</span>
                ) : (
                    <span
                        className={`inline-flex items-center gap-2 self-start rounded-full px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-white ${
                            enUso ? 'bg-amber-500' : 'bg-emerald-600'
                        }`}
                    >
                        {enUso ? <Clock3 size={14} strokeWidth={3} /> : <CircleCheck size={14} strokeWidth={3} />}
                        {enUso ? 'En uso' : 'Disponible'}
                    </span>
                )}
            </div>

            {!cargando && enUso && (
                <dl className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                    {datos.map(([etiqueta, valor]) => (
                        <div key={etiqueta} className="rounded-xl border border-amber-200/70 bg-white/80 p-3">
                            <dt className="text-[9px] font-black uppercase tracking-wider text-slate-400">{etiqueta}</dt>
                            <dd className="mt-1 truncate text-base font-black uppercase text-slate-800" title={valor}>
                                {valor}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}

            {!cargando && !enUso && (
                <p className="mt-6 text-sm font-semibold text-slate-500">
                    Sin préstamo abierto. La planta puede prestarse a una aeronave.
                </p>
            )}

            {!cargando && puedeOperar && (
                <div className="mt-6 flex justify-end">
                    {enUso ? (
                        <button
                            type="button"
                            onClick={onEntregar}
                            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-600 active:scale-95"
                        >
                            <CircleCheck size={18} />
                            Registrar entrega
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onPrestar}
                            className="flex items-center gap-2 rounded-xl bg-[#00677F] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#00586D] active:scale-95"
                        >
                            <Plus size={18} />
                            Registrar préstamo
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}
