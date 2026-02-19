import { useMatriculaAutocompleteStore } from "@/stores/useMatriculaAutocompleteStore";
import DateTimeModalSliderInput from "@/pages/DateTimeInput";
import InputMatricula from "@/pages/InputMatricula";
import { useEffect, useState } from "react";
import FirmaCanvas from "@/pages/FirmaCanvas";
import { Plane, Calendar, User, ClipboardList, Truck } from "lucide-react"; // Opcional: Iconos

interface Props {
    data: any;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    updateField: (key: string, value: any) => void;
}

function FirmaBox({ label, value, onClick }: { label: string; value?: string; onClick: () => void }) {
    return (
        <div
            onClick={onClick}
            className="group relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white transition-all hover:border-blue-500 hover:bg-blue-50/50"
        >
            <span className="absolute top-3 left-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-blue-600">
                {label}
            </span>

            {value ? (
                <img src={value} alt={label} className="h-28 w-full object-contain p-2" />
            ) : (
                <div className="flex flex-col items-center gap-2">
                    <div className="rounded-full bg-slate-100 p-2 group-hover:bg-blue-100">
                        <svg className="h-5 w-5 text-slate-400 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </div>
                    <span className="text-sm font-medium text-slate-500 group-hover:text-blue-600">Clic para firmar</span>
                </div>
            )}
        </div>
    );
}

export default function MovimientoCSAEEntrada({ data, onChange, updateField }: Props) {
    const { tipoAeronave } = useMatriculaAutocompleteStore();
    const [openFirma, setOpenFirma] = useState<null | "firma_entrada">(null);

    useEffect(() => {
        if (tipoAeronave) {
            onChange({
                target: { name: "tipo_aeronave", value: tipoAeronave },
            } as React.ChangeEvent<HTMLInputElement>);
        }
    }, [tipoAeronave]);

    const labelStyle = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-700";
    const inputStyle = "w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm transition-focus focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none";

    return (
        <section className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Header con gradiente sutil */}
            <header className="border-b border-slate-100 bg-slate-50/50 px-6 py-5 text-center">
                <h2 className="text-xl font-extrabold tracking-tight text-slate-800">
                    AVIONES DE CSAE GUARDA
                </h2>
                <div className="mt-1 flex items-center justify-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <p className="text-xs font-medium uppercase tracking-widest text-slate-500">
                        Registro de Entrada
                    </p>
                </div>
            </header>

            <div className="p-6 space-y-8">
                {/* Sección 1: Datos de Aeronave */}
                <div>
                    <div className="mb-4 flex items-center gap-2 border-b border-slate-50 pb-2 text-blue-600">
                        <Plane size={18} />
                        <h3 className="text-sm font-bold uppercase italic">Información de Aeronave</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <DateTimeModalSliderInput
                            label="Fecha y hora de entrada"
                            name="fecha_hora_entrada"
                            value={data.fecha_hora_entrada}
                            onChange={onChange}
                            required
                        />
                        <InputMatricula
                            label="Matrícula"
                            value={data.matricula}
                            required
                            onSelect={(value) =>
                                onChange({ target: { name: "matricula", value } } as React.ChangeEvent<HTMLInputElement>)
                            }
                        />
                        <div>
                            <label className={labelStyle}>Tipo de Aeronave</label>
                            <input
                                type="text"
                                name="tipo_aeronave"
                                placeholder="Ej. CESSNA 182"
                                value={data.tipo_aeronave}
                                onChange={(e) => {
                                    e.target.value = e.target.value.toUpperCase();
                                    onChange(e);
                                }}
                                className={`${inputStyle} font-mono uppercase placeholder:italic`}
                            />
                        </div>
                    </div>
                </div>

                {/* Sección 2: Logística */}
                <div>
                    <div className="mb-4 flex items-center gap-2 border-b border-slate-50 pb-2 text-blue-600">
                        <Truck size={18} />
                        <h3 className="text-sm font-bold uppercase italic">Logística y Traslado</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelStyle}>Cómo llega</label>
                            <input
                                type="text"
                                name="como_llega"
                                value={data.como_llega}
                                onChange={onChange}
                                placeholder="Ej. Vuelo directo / Remolcado"
                                className={inputStyle}
                            />
                        </div>
                        <div>
                            <label className={labelStyle}>Transportista / Piloto</label>
                            <input
                                type="text"
                                name="transportista"
                                value={data.transportista}
                                onChange={onChange}
                                className={inputStyle}
                            />
                        </div>
                    </div>
                </div>

                {/* Sección 3: Observaciones y Firma */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-blue-600">
                            <ClipboardList size={18} />
                            <h3 className="text-sm font-bold uppercase italic">Observaciones</h3>
                        </div>
                        <textarea
                            name="observaciones_entrada"
                            rows={4}
                            value={data.observaciones_entrada}
                            onChange={onChange}
                            placeholder="Detalles adicionales sobre el estado de la aeronave..."
                            className={`${inputStyle} resize-none`}
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-blue-600">
                            <User size={18} />
                            <h3 className="text-sm font-bold uppercase italic">Validación</h3>
                        </div>
                        <div>
                            <label className={labelStyle}>Personal que recibe</label>
                            <input
                                type="text"
                                name="quien_recibe"
                                value={data.quien_recibe}
                                onChange={onChange}
                                className={`${inputStyle} mb-4`}
                            />
                            <FirmaBox
                                label="Firma Autorizada"
                                value={data.firma_entrada}
                                onClick={() => setOpenFirma("firma_entrada")}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <FirmaCanvas
                open={openFirma === "firma_entrada"}
                title="Firma de Entrada"
                value={data.firma_entrada}
                onClose={() => setOpenFirma(null)}
                onChange={(b64: string) => updateField("firma_entrada", b64)}
            />
        </section>
    );
}
