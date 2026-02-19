import DateTimeModalSliderInput from "@/pages/DateTimeInput";
import FirmaCanvas from "@/pages/FirmaCanvas";
import { useState } from "react";
import { LogOut, History, ClipboardCheck, PenTool, Hash, Info } from "lucide-react";

interface Props {
    data: any;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    updateField: (key: string, value: any) => void;
}
const formatFechaSalida = (fecha?: string | null) => {
    if (!fecha) return "—";
    const [datePart, timePart] = fecha.split("T");
    if (!datePart || !timePart) return "—";

    const [year, month, day] = datePart.split("-");
    const time = timePart.slice(0, 5);
    return `${day}/${month}/${year} ${time}`;
};
export default function MovimientoCSAESalida({ data, onChange, updateField }: Props) {
    const [openFirma, setOpenFirma] = useState<null | "firma_salida">(null);

    return (
        <section className="mx-auto max-w-5xl space-y-4 p-2">
            <div className="flex items-end justify-between px-4 py-2 border-b-2 border-slate-900 mb-6">
                <div>
                    <h2 className="text-3xl font-black italic tracking-tighter text-slate-900 flex items-center gap-2">
                        SALIDA <LogOut className="text-red-500" size={28} />
                    </h2>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">AVIONES DE CSAE GUARDA</p>
                </div>
                <div className="text-right">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Matrícula</span>
                    <span className="text-xl font-mono font-bold bg-slate-900 text-white px-3 py-1 rounded">
                        {data.matricula || "N/A"}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-4 space-y-4">
                    <div className="bg-blue-900 rounded-2xl p-5 text-slate-300 shadow-xl relative overflow-hidden">
                        <div className="absolute -right-4 -top-4 opacity-10 text-white">
                            <History size={120} />
                        </div>

                        <div className="flex items-center gap-2 mb-6 border-b border-slate-700 pb-2">
                            <Info size={14} className="text-blue-400" />
                            <h3 className="text-[10px] font-bold uppercase tracking-widest">Antecedentes de Entrada</h3>
                        </div>

                        <div className="space-y-4 relative z-10">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] uppercase font-medium text-slate-500">Tipo:</span>
                                <span className="text-xs font-bold text-white">{data.tipo_aeronave || "—"}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] uppercase font-medium text-slate-500">Arribo:</span>
                                <span className="text-xs font-mono text-blue-400">
                                    {formatFechaSalida(data.fecha_hora_entrada)}
                                </span>
                            </div>
                            <div className="pt-2">
                                <p className="text-[10px] uppercase font-medium text-slate-500 mb-2 italic">Validación de Ingreso:</p>
                                <div className="bg-white/5 rounded-lg p-2 border border-white/10">
                                    <img src={data.firma_entrada} className="h-16 w-full object-contain invert" alt="Firma" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="md:col-span-8 grid grid-cols-1 gap-4">

                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ClipboardCheck size={18} className="text-slate-900" />
                                <span className="text-xs font-black uppercase tracking-widest text-slate-900">Manifiesto de Salida</span>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                <DateTimeModalSliderInput
                                    label="Despacho Programado"
                                    name="fecha_hora_salida"
                                    value={data.fecha_hora_salida}
                                    onChange={onChange}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Observaciones Técnicas</label>
                                <textarea
                                    name="observaciones_salida"
                                    rows={4}
                                    placeholder="Indique el estado de la aeronave al salir, personal involucrado y equipo entregado..."
                                    value={data.observaciones_salida}
                                    onChange={onChange}
                                    className="w-full bg-white border-2 border-slate-100 rounded-xl p-4 text-sm focus:border-slate-900 outline-none transition-all placeholder:text-slate-300 shadow-inner"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center pt-4">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-slate-900">Validación de Salida</h4>
                                    <p className="text-xs text-slate-500">Al firmar, el personal certifica que la aeronave sale bajo las condiciones descritas.</p>
                                </div>
                                <div
                                    onClick={() => setOpenFirma("firma_salida")}
                                    className="h-32 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-slate-900 hover:bg-white transition-all group"
                                >
                                    {data.firma_salida ? (
                                        <img src={data.firma_salida} className="h-full w-full object-contain p-2" alt="Firma" />
                                    ) : (
                                        <>
                                            <PenTool size={24} className="text-slate-300 group-hover:text-slate-900 mb-2 transition-colors" />
                                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-900 uppercase tracking-tighter">Capturar Firma</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <FirmaCanvas
                open={openFirma === "firma_salida"}
                title="Protocolo de Salida"
                value={data.firma_salida}
                onClose={() => setOpenFirma(null)}
                onChange={(b64: string) => updateField("firma_salida", b64)}
            />
        </section>
    );
}
