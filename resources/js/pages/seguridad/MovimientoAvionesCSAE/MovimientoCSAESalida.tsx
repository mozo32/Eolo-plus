import {
    useState,
    type ChangeEvent,
} from 'react';
import DateTimeModalSliderInput from '@/pages/DateTimeInput';
import FirmaCanvas from '@/pages/FirmaCanvas';
import {
    CalendarDays,
    ClipboardCheck,
    Clock3,
    History,
    LogOut,
    PenTool,
    Plane,
} from 'lucide-react';

interface Props {
    data: any;

    onChange: (
        event: ChangeEvent<
            HTMLInputElement |
            HTMLTextAreaElement |
            HTMLSelectElement
        >,
    ) => void;

    updateField: (key: string, value: any) => void;
}

const formatFechaHora = (
    fecha?: string | null,
) => {
    if (!fecha) return '—';

    const value = String(fecha);
    const normalized = value.replace(' ', 'T');
    const [datePart, timePart = ''] =
        normalized.split('T');

    const [year, month, day] =
        datePart.split('-');

    if (!year || !month || !day) {
        return value;
    }

    const hora = timePart.slice(0, 5);

    return `${day}/${month}/${year}${hora ? ` ${hora}` : ''
        }`;
};

export default function MovimientoCSAESalida({
    data,
    onChange,
    updateField,
}: Props) {
    const [openFirma, setOpenFirma] = useState<
        null | 'firma_salida'
    >(null);
    const formatearHora24 = (valor: string): string | null => {
        const numeros = valor.replace(/\D/g, '').slice(0, 4);

        if (numeros.length >= 1 && Number(numeros[0]) > 2) {
            return null;
        }

        if (
            numeros.length >= 2 &&
            numeros[0] === '2' &&
            Number(numeros[1]) > 3
        ) {
            return null;
        }

        if (
            numeros.length >= 3 &&
            Number(numeros[2]) > 5
        ) {
            return null;
        }

        if (numeros.length <= 2) {
            return numeros;
        }

        return `${numeros.slice(0, 2)}:${numeros.slice(2)}`;
    };
    const inputStyle =
        'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20';

    return (
        <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Resumen */}
                <div className="lg:col-span-1">
                    <div className="overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-xl lg:sticky lg:top-4">
                        <header className="flex items-center justify-between bg-blue-900 p-6 text-white">
                            <div>
                                <p className="text-sm font-bold">
                                    Antecedentes
                                </p>

                                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-blue-200">
                                    Información de entrada
                                </p>
                            </div>

                            <History size={30} />
                        </header>

                        <div className="space-y-5 p-6">
                            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center">
                                <span className="block text-[9px] font-black uppercase tracking-widest text-blue-500">
                                    Matrícula
                                </span>

                                <span className="mt-1 block font-mono text-2xl font-black uppercase text-blue-700">
                                    {data.matricula || 'N/A'}
                                </span>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                                    <div className="rounded-xl bg-white p-2 text-blue-600 shadow-sm">
                                        <Plane size={17} />
                                    </div>

                                    <div>
                                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                                            Tipo de aeronave
                                        </span>

                                        <span className="text-xs font-black uppercase text-slate-700">
                                            {data.tipo_aeronave ||
                                                'Sin información'}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                                    <div className="rounded-xl bg-white p-2 text-blue-600 shadow-sm">
                                        <CalendarDays
                                            size={17}
                                        />
                                    </div>

                                    <div>
                                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                                            Fecha de entrada
                                        </span>

                                        <span className="text-xs font-black text-slate-700">
                                            <span className="text-xs font-black text-slate-700">
                                                {data.fecha_entrada &&
                                                    data.hora_entrada
                                                    ? `${data.fecha_entrada
                                                        .split('-')
                                                        .reverse()
                                                        .join('/')} ${data.hora_entrada}`
                                                    : '—'}
                                            </span>
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
                                    <div className="rounded-xl bg-white p-2 text-blue-600 shadow-sm">
                                        <Clock3 size={17} />
                                    </div>

                                    <div>
                                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                                            Estado actual
                                        </span>

                                        <span className="text-xs font-black uppercase text-orange-600">
                                            Pendiente de salida
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <span className="mb-2 block text-[10px] font-black uppercase tracking-wider text-slate-400">
                                    Firma de entrada
                                </span>

                                <div className="flex min-h-[120px] items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">
                                    {data.firma_entrada ? (
                                        <img
                                            src={
                                                data.firma_entrada
                                            }
                                            className="h-28 w-full object-contain p-3"
                                            alt="Firma de entrada"
                                        />
                                    ) : (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                                            Firma no disponible
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Captura de salida */}
                <div className="lg:col-span-2">
                    <div className="flex min-h-[600px] flex-col overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-xl">
                        <header className="flex flex-col justify-between gap-4 bg-blue-900 p-6 text-white md:flex-row md:items-center">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">
                                    Registrar salida
                                </h1>

                                <p className="mt-1 text-sm font-medium text-blue-200">
                                    Complete el manifiesto de salida
                                    de la aeronave
                                </p>
                            </div>

                            <div className="flex items-center gap-3 rounded-2xl border border-blue-700 bg-blue-800/50 px-4 py-3">
                                <LogOut
                                    size={18}
                                    className="text-blue-200"
                                />

                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">
                                    Proceso de despacho
                                </span>
                            </div>
                        </header>

                        <div className="flex-1 space-y-8 p-6 md:p-8">
                            <section>
                                <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                                    <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                                        <ClipboardCheck
                                            size={18}
                                        />
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                            Manifiesto de salida
                                        </h3>

                                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                            Fecha y condiciones de
                                            despacho
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                    <div className="grid grid-cols-1 gap-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-2">
                                        <div>
                                            <label className="mb-1 ml-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">
                                                Fecha de salida
                                            </label>

                                            <div className="relative">
                                                <CalendarDays
                                                    size={18}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                                />

                                                <input
                                                    type="date"
                                                    name="fecha_salida"
                                                    value={data.fecha_salida}
                                                    readOnly
                                                    tabIndex={-1}
                                                    className={`${inputStyle} cursor-not-allowed pl-10 text-slate-500`}
                                                />
                                            </div>

                                            <p className="ml-1 mt-1 text-[9px] font-bold text-slate-400">
                                                Fecha automática de México
                                            </p>
                                        </div>

                                        <div>
                                            <label className="mb-1 ml-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">
                                                Hora de salida
                                            </label>

                                            <div className="relative">
                                                <Clock3
                                                    size={18}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                                />

                                                <input
                                                    type="text"
                                                    name="hora_salida"
                                                    value={data.hora_salida}
                                                    inputMode="numeric"
                                                    autoComplete="off"
                                                    maxLength={5}
                                                    placeholder="HH:MM"
                                                    pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$"
                                                    title="Escriba una hora válida en formato de 24 horas, por ejemplo 21:45"
                                                    required
                                                    onChange={(event) => {
                                                        const horaFormateada = formatearHora24(
                                                            event.target.value,
                                                        );

                                                        if (horaFormateada !== null) {
                                                            updateField(
                                                                'hora_salida',
                                                                horaFormateada,
                                                            );
                                                        }
                                                    }}
                                                    className={`${inputStyle} pl-10 font-mono tracking-widest`}
                                                />
                                            </div>

                                            <p className="ml-1 mt-1 text-[9px] font-bold text-slate-400">
                                                Escriba la hora en formato de 24 horas, por ejemplo 21:45
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">
                                    Observaciones de salida
                                </label>

                                <textarea
                                    name="observaciones_salida"
                                    rows={6}
                                    value={
                                        data.observaciones_salida
                                    }
                                    onChange={onChange}
                                    placeholder="Indique el estado de la aeronave, personal involucrado y cualquier equipo entregado..."
                                    className={`${inputStyle} resize-none`}
                                />
                            </section>

                            <section>
                                <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                                    <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                                        <PenTool size={18} />
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                            Validación de salida
                                        </h3>

                                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                            Firma del personal
                                            responsable
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
                                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
                                        <h4 className="text-sm font-black text-blue-900">
                                            Confirmación de entrega
                                        </h4>

                                        <p className="mt-2 text-xs font-medium leading-relaxed text-blue-700">
                                            Al firmar, el personal
                                            certifica que la aeronave
                                            sale bajo las condiciones
                                            descritas.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setOpenFirma(
                                                'firma_salida',
                                            )
                                        }
                                        className="group flex min-h-[160px] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition-all hover:border-blue-500 hover:bg-blue-50"
                                    >
                                        {data.firma_salida ? (
                                            <img
                                                src={
                                                    data.firma_salida
                                                }
                                                className="h-36 w-full object-contain p-3"
                                                alt="Firma de salida"
                                            />
                                        ) : (
                                            <>
                                                <div className="rounded-full bg-white p-3 shadow-sm group-hover:bg-blue-100">
                                                    <PenTool
                                                        size={23}
                                                        className="text-slate-400 group-hover:text-blue-600"
                                                    />
                                                </div>

                                                <span className="mt-3 text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-blue-600">
                                                    Capturar firma
                                                </span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </div>

            <FirmaCanvas
                open={openFirma === 'firma_salida'}
                title="Firma de salida"
                value={data.firma_salida}
                onClose={() => setOpenFirma(null)}
                onChange={(base64: string) =>
                    updateField(
                        'firma_salida',
                        base64,
                    )
                }
            />
        </div>
    );
}
