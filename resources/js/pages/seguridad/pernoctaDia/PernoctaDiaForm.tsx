import React, { useState, useMemo } from "react";
import { validatePernoctaDia } from "./validation";
import { usePage } from "@inertiajs/react";
import { Plane, User, MapPin, ClipboardList, Calendar, PlusCircle, CheckCircle2 } from "lucide-react";
export type PernoctaDiaItem = {
    fecha: string;
    hora: string;
    matricula: string;
    ubicacion: string;
    observaciones: string;
    nombre: string;
};
const PernoctaDiaForm: React.FC<{ onAdd: (item: any) => void }> = ({ onAdd }) => {
    const today = new Date().toLocaleDateString("en-CA");
    const { auth } = usePage<{ auth: { user: any } }>().props;

    const [form, setForm] = useState({
        fecha: today,
        hora: "",
        matricula: "",
        ubicacion: "",
        observaciones: "",
        nombre: auth?.user?.name ?? "",
    });

    const [sugerencias, setSugerencias] = useState<string[]>([]);
    const [loadingMatricula, setLoadingMatricula] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const statusMatricula = useMemo(() => {
        if (!form.matricula) return { ok: true, msg: "" };
        const regex = /^[A-Z0-9]{1,3}-[A-Z0-9]{1,5}$|^N[1-9][0-9A-Z]{0,4}$/;
        return regex.test(form.matricula) ? { ok: true, msg: "Formato Correcto" } : { ok: false, msg: "Formato Inválido" };
    }, [form.matricula]);

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        let finalValue = value;
        if (name === "matricula") {
            finalValue = value.toUpperCase().replace(/\s/g, "");
            if (finalValue.length === 2 && !finalValue.includes("-")) finalValue += "-";
        }
        setForm({ ...form, [name]: finalValue });
        if (name === "matricula" && finalValue.length > 1) buscarMatriculas(finalValue);
    };

    const buscarMatriculas = async (q: string) => {
        setLoadingMatricula(true);
        try {
            const res = await fetch(`/api/PernoctaDia/matriculas/buscar?q=${q}`);
            setSugerencias(await res.json());
        } catch { setSugerencias([]); } finally { setLoadingMatricula(false); }
    };

    const inputStyle = (err: any) => `w-full px-4 py-3 rounded-xl border-2 transition-all text-sm font-bold ${err ? 'border-rose-400 bg-rose-50' : 'border-slate-100 focus:border-blue-600 focus:ring-4 focus:ring-blue-50'} dark:bg-slate-900`;

    return (
        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
            <header className="bg-blue-900 text-white p-8 flex justify-between items-center shadow-lg">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-widest">Pernocta de Día</h1>
                    <p className="text-sm opacity-80 uppercase font-medium">Control de Pernoctas Diarias de Aeronaves</p>
                </div>
                <Plane size={40} className="opacity-40" />
            </header>
            <div className="p-8 space-y-8">
                <div className="flex flex-wrap gap-6 justify-between items-center pb-6 border-b border-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"><User size={18} /></div>
                        <div>
                            <p className="text-[9px] font-black text-slate-400 tracking-widest">Responsable</p>
                            <p className="text-sm font-bold text-slate-700 italic">{form.nombre}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-[9px] font-black text-slate-400 tracking-widest">Fecha de Captura</p>
                            <input type="date" name="fecha" value={form.fecha} onChange={handleChange} className="text-sm font-black text-blue-600 bg-transparent outline-none" />
                        </div>
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><Calendar size={18} /></div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="relative space-y-2">
                        <label className="text-[10px] font-black text-slate-500 tracking-[0.2em] ml-1">Matrícula</label>
                        <input name="matricula" value={form.matricula} onChange={handleChange} placeholder="XA-ABC" className={inputStyle(errors.matricula)} />
                        {form.matricula && <span className={`text-[9px] font-black ml-1 ${statusMatricula.ok ? 'text-emerald-500' : 'text-rose-500'}`}>{statusMatricula.msg}</span>}
                        {sugerencias.length > 0 && (
                            <ul className="absolute z-30 mt-2 w-full bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden">
                                {sugerencias.map(s => (
                                    <li key={s} onClick={() => { setForm({ ...form, matricula: s }); setSugerencias([]); }} className="px-4 py-3 text-sm font-bold hover:bg-blue-50 cursor-pointer border-b last:border-0">{s}</li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 tracking-[0.2em] ml-1">Ubicación</label>
                        <div className="grid grid-cols-2 gap-4">
                            {["H1", "H2"].map(h => (
                                <label key={h} className={`flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all font-black text-xs ${form.ubicacion === h ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-50 bg-slate-50 text-slate-400 hover:border-slate-200'}`}>
                                    <input type="radio" name="ubicacion" value={h} checked={form.ubicacion === h} onChange={handleChange} className="hidden" />
                                    {h === "H1" ? "HANGAR 1" : "HANGAR 2"}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[10px] font-black text-slate-500 tracking-[0.2em] ml-1">Observaciones</label>
                        <textarea name="observaciones" value={form.observaciones} onChange={handleChange} rows={2} className={`${inputStyle(false)} resize-none`} placeholder="Notas de pernocta..." />
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button type="button" onClick={() => { onAdd(form); setForm({ ...form, matricula: "", observaciones: "" }); }} className="flex items-center gap-2 bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-black transition-all active:scale-95">
                        <PlusCircle size={18} /> Agregar a Lista
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PernoctaDiaForm;
