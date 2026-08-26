import {
    useEffect,
    useState,
    type ChangeEvent,
} from 'react';
import { useMatriculaAutocompleteStore } from '@/stores/useMatriculaAutocompleteStore';
import DateTimeModalSliderInput from '@/pages/DateTimeInput';
import InputMatricula from '@/pages/InputMatricula';
import FirmaCanvas from '@/pages/FirmaCanvas';
import {
    CalendarDays,
    ClipboardList,
    Clock3,
    PenTool,
    Plane,
    Truck,
    User,
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

function FirmaBox({
    label,
    value,
    onClick,
}: {
    label: string;
    value?: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group relative flex min-h-[160px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 transition-all hover:border-blue-500 hover:bg-blue-50"
        >
            <span className="absolute left-4 top-3 text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-blue-600">
                {label}
            </span>

            {value ? (
                <img
                    src={value}
                    alt={label}
                    className="h-32 w-full object-contain p-4"
                />
            ) : (
                <div className="flex flex-col items-center gap-3 pt-5">
                    <div className="rounded-full bg-white p-3 shadow-sm transition-colors group-hover:bg-blue-100">
                        <PenTool
                            size={22}
                            className="text-slate-400 group-hover:text-blue-600"
                        />
                    </div>

                    <div className="text-center">
                        <span className="block text-xs font-black uppercase text-slate-500 group-hover:text-blue-600">
                            Capturar firma
                        </span>

                        <span className="mt-1 block text-[9px] font-bold text-slate-400">
                            Presione para abrir el panel
                        </span>
                    </div>
                </div>
            )}
        </button>
    );
}

export default function MovimientoCSAEEntrada({
    data,
    onChange,
    updateField,
}: Props) {
    const { tipoAeronave } =
        useMatriculaAutocompleteStore();

    const [openFirma, setOpenFirma] = useState<
        null | 'firma_entrada'
    >(null);

    useEffect(() => {
        if (!tipoAeronave) return;

        onChange({
            target: {
                name: 'tipo_aeronave',
                value: tipoAeronave,
            },
        } as ChangeEvent<HTMLInputElement>);
    }, [tipoAeronave, onChange]);

    const labelStyle =
        'mb-1 ml-1 block text-[10px] font-black uppercase tracking-wide text-slate-400';

    const inputStyle =
        'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition-all placeholder:font-medium placeholder:text-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20';
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
    return (
        <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Panel izquierdo */}
                <div className="lg:col-span-1">
                    <div className="overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-xl lg:sticky lg:top-4">
                        <header className="flex items-center justify-between bg-blue-900 p-6 text-white">
                            <div>
                                <p className="text-sm font-bold">
                                    Datos de la aeronave
                                </p>

                                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-blue-200">
                                    Registro de entrada
                                </p>
                            </div>

                            <Plane size={30} />
                        </header>

                        <div className="space-y-5 p-6">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className={labelStyle}>
                                        Fecha de entrada
                                    </label>

                                    <div className="relative">
                                        <CalendarDays
                                            size={18}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                        />

                                        <input
                                            type="date"
                                            name="fecha_entrada"
                                            value={data.fecha_entrada}
                                            onChange={onChange}
                                            required
                                            className={`${inputStyle} pl-10`}
                                        />
                                    </div>

                                    <p className="ml-1 mt-1 text-[9px] font-bold text-slate-400">
                                        Puede modificar la fecha de entrada
                                    </p>
                                </div>

                                <div>
                                    <label className={labelStyle}>
                                        Hora de entrada
                                    </label>

                                    <div className="relative">
                                        <Clock3
                                            size={18}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                        />

                                        <input
                                            type="text"
                                            name="hora_entrada"
                                            value={data.hora_entrada}
                                            inputMode="numeric"
                                            autoComplete="off"
                                            maxLength={5}
                                            placeholder="HH:MM"
                                            pattern="^([01][0-9]|2[0-3]):[0-5][0-9]$"
                                            title="Escriba una hora válida en formato de 24 horas, por ejemplo 18:30"
                                            required
                                            onChange={(event) => {
                                                const horaFormateada = formatearHora24(
                                                    event.target.value,
                                                );

                                                if (horaFormateada !== null) {
                                                    updateField(
                                                        'hora_entrada',
                                                        horaFormateada,
                                                    );
                                                }
                                            }}
                                            className={`${inputStyle} pl-10 font-mono tracking-widest`}
                                        />
                                    </div>

                                    <p className="ml-1 mt-1 text-[9px] font-bold text-slate-400">
                                        Escriba la hora en formato de 24 horas, por ejemplo 18:30
                                    </p>
                                </div>
                            </div>

                            <InputMatricula
                                label="Matrícula"
                                value={data.matricula}
                                required
                                onSelect={(value) =>
                                    onChange({
                                        target: {
                                            name: 'matricula',
                                            value: value.toUpperCase(),
                                        },
                                    } as React.ChangeEvent<HTMLInputElement>)
                                }
                            />

                            <div>
                                <label className={labelStyle}>
                                    Tipo de aeronave *
                                </label>

                                <div className="relative">
                                    <Plane
                                        size={18}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                    />

                                    <input
                                        type="text"
                                        name="tipo_aeronave"
                                        value={data.tipo_aeronave}
                                        placeholder="Ej. CESSNA 182"
                                        required
                                        onChange={(event) => {
                                            event.target.value =
                                                event.target.value.toUpperCase();

                                            onChange(event);
                                        }}
                                        className={`${inputStyle} pl-10 font-mono uppercase`}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Panel derecho */}
                <div className="space-y-6 lg:col-span-2">
                    <div className="flex min-h-[600px] flex-col overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-xl">
                        <header className="flex flex-col justify-between gap-4 bg-blue-900 p-6 text-white md:flex-row md:items-center">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight">
                                    Movimiento de entrada
                                </h1>

                                <p className="mt-1 text-sm font-medium text-blue-200">
                                    Complete la logística y validación
                                    del ingreso
                                </p>
                            </div>

                            <div className="flex items-center gap-3 rounded-2xl border border-blue-700 bg-blue-800/50 px-4 py-3">
                                <span className="relative flex h-3 w-3">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />

                                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
                                </span>

                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-100">
                                    Entrada activa
                                </span>
                            </div>
                        </header>

                        <div className="flex-1 space-y-8 p-6 md:p-8">
                            {/* Logística */}
                            <section>
                                <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                                    <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                                        <Truck size={18} />
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                            Logística y traslado
                                        </h3>

                                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                            Información de llegada
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                    <div>
                                        <label
                                            className={
                                                labelStyle
                                            }
                                        >
                                            Cómo llega *
                                        </label>

                                        <div className="relative">
                                            <Truck
                                                size={18}
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                            />

                                            <input
                                                type="text"
                                                name="como_llega"
                                                value={
                                                    data.como_llega
                                                }
                                                onChange={
                                                    onChange
                                                }
                                                placeholder="Vuelo directo, remolcado..."
                                                required
                                                className={`${inputStyle} pl-10`}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label
                                            className={
                                                labelStyle
                                            }
                                        >
                                            Transportista o piloto *
                                        </label>

                                        <div className="relative">
                                            <User
                                                size={18}
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                            />

                                            <input
                                                type="text"
                                                name="transportista"
                                                value={
                                                    data.transportista
                                                }
                                                onChange={
                                                    onChange
                                                }
                                                placeholder="Nombre del transportista"
                                                required
                                                className={`${inputStyle} pl-10`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Observaciones */}
                            <section>
                                <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                                    <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                                        <ClipboardList size={18} />
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                            Observaciones
                                        </h3>

                                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                            Condiciones de ingreso
                                        </p>
                                    </div>
                                </div>

                                <textarea
                                    name="observaciones_entrada"
                                    rows={5}
                                    value={
                                        data.observaciones_entrada
                                    }
                                    onChange={onChange}
                                    placeholder="Agregue detalles sobre el estado de la aeronave..."
                                    className={`${inputStyle} resize-none`}
                                />
                            </section>

                            {/* Validación */}
                            <section>
                                <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                                    <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                                        <User size={18} />
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                            Validación
                                        </h3>

                                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                            Personal y firma opcional de entrada
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                    <div>
                                        <label
                                            className={
                                                labelStyle
                                            }
                                        >
                                            Personal que recibe
                                        </label>

                                        <div className="relative">
                                            <User
                                                size={18}
                                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                            />

                                            <input
                                                type="text"
                                                name="quien_recibe"
                                                value={
                                                    data.quien_recibe
                                                }
                                                onChange={
                                                    onChange
                                                }
                                                placeholder="Nombre del personal"
                                                className={`${inputStyle} pl-10`}
                                            />
                                        </div>

                                        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-blue-700">
                                                Confirmación de ingreso
                                            </p>

                                            <p className="mt-1 text-xs font-medium leading-relaxed text-blue-600">
                                                La firma es opcional. Si
                                                se captura, confirma la
                                                recepción y el estado
                                                registrado de la aeronave.
                                            </p>
                                        </div>
                                    </div>

                                    <FirmaBox
                                        label="Firma autorizada (opcional)"
                                        value={
                                            data.firma_entrada
                                        }
                                        onClick={() =>
                                            setOpenFirma(
                                                'firma_entrada',
                                            )
                                        }
                                    />
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </div>

            <FirmaCanvas
                open={openFirma === 'firma_entrada'}
                title="Firma de entrada"
                value={data.firma_entrada}
                onClose={() => setOpenFirma(null)}
                onChange={(base64: string) =>
                    updateField(
                        'firma_entrada',
                        base64,
                    )
                }
            />
        </div>
    );
}
