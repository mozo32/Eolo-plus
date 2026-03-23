import { useState, useEffect } from "react";
import ResibeTurnoCon from "./sections/ResibeTurnoCon";
import RevisionSalas from "./sections/RevisionSalas";
import HotTrasComiCoor from "./sections/HotTrasComiCoor";
import EntregaTurnoCon from "./sections/EntregaTurnoCon";
import { validarPaso } from "./Validacion";
import FirmaCanvas from "@/pages/FirmaCanvas";
import { guardarCheckListTurnoApi, actualizarCheckListTurnoApi, buscarUsuariosApi } from "@/stores/apiCheckListTurno";
import Swal from "sweetalert2";
import { Package, CheckCircle2 } from "lucide-react";

function FirmaBox({ label, value, onClick }: { label: string; value?: string; onClick: () => void }) {
    return (
        <div onClick={onClick} className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 hover:border-[#00677F] hover:bg-blue-50 transition-all">
            <span className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-600">{label}</span>
            {value ? <img src={value} alt={label} className="h-24 w-full object-contain" /> : <span className="text-sm text-slate-400 font-medium">Click para firmar</span>}
        </div>
    );
}

const getInitialForm = (data?: any) => ({
    nombreEmpleado: data?.nombre_empleado ?? "",
    fecha: data?.fecha ? new Date(data.fecha).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    recibeTurnoCon: data?.recibe_turno_con ?? {},
    observaciones_recibe: data?.observaciones_recibe ?? "",
    revisionSalas: data?.revision_salas ?? {},
    HotTrasComiCoor: data?.hot_tras_comi_coor ?? [],
    revision_base_operaciones: data?.revision_base_operaciones ?? false,
    envia_resumen_semanal: data?.envia_resumen_semanal ?? false,
    envia_informe_diario: data?.envia_informe_diario ?? false,
    entregaTurnoCon: data?.entrega_turno_con ?? {},
    observaciones_entrega: data?.observaciones_entrega ?? "",
    cantidad_pasajeros: data?.cantidad_pasajeros ?? "",
    cantidad_operaciones: data?.cantidad_operaciones ?? "",
    firma: data?.firmas?.[0]?.url ?? "",
});

export default function CheckListTurnoForm({ isEdit, data, onSuccess }: { isEdit: boolean; data?: any; open: boolean; onSuccess?: () => void }) {
    const [step, setStep] = useState(1);
    const totalSteps = 5;
    const [buscando, setBuscando] = useState(false);
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [openFirma, setOpenFirma] = useState<null | "firma_validacion">(null);
    const [form, setForm] = useState(() => getInitialForm(data));

    useEffect(() => {
        setForm(getInitialForm(isEdit ? data : undefined));
        setStep(1);
    }, [data, isEdit]);

    const updateField = (path: string, value: any) => {
        setForm((prev: any) => {
            const keys = path.split(".");
            const updated = { ...prev };
            let current = updated;
            keys.forEach((key, i) => {
                if (i === keys.length - 1) current[key] = value;
                else {
                    current[key] = { ...current[key] };
                    current = current[key];
                }
            });
            return updated;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (step < totalSteps) {
            if (validarPaso(form, step)) setStep(s => s + 1);
            return;
        }
        if (!validarPaso(form, step)) return;

        try {
            Swal.fire({ title: "Guardando...", didOpen: () => Swal.showLoading() });
            if (isEdit && data?.id) await actualizarCheckListTurnoApi(data.id, form);
            else await guardarCheckListTurnoApi(form);
            Swal.fire({ icon: "success", title: "Completado con éxito" });
            onSuccess?.();
        } catch (error: any) {
            Swal.fire({ icon: "error", title: "Error", text: error?.message || "Error al procesar" });
        }
    };

    return (
        <>
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 px-4">
                    <div className="flex justify-between mb-2">
                        {['Inicio', 'Salas', 'Coordinaciones', 'Entrega', 'Final'].map((label, i) => (
                            <div key={i} className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border text-slate-400'}`}>
                                    {step > i + 1 ? <CheckCircle2 size={16} /> : i + 1}
                                </div>
                                <span className={`text-[9px] mt-1 uppercase font-black ${step === i + 1 ? 'text-blue-600' : 'text-slate-400'}`}>{label}</span>
                            </div>
                        ))}
                    </div>
                    <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }} />
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="mx-auto max-w-6xl overflow-hidden rounded-xl border border-slate-300 bg-white shadow-xl">
                <header className="bg-[#1e3a8a] text-white p-8 flex justify-between items-center shadow-md">
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-widest">Entrega de Turno</h1>
                        <p className="text-sm opacity-80 uppercase font-medium">Formato de Control y Operaciones de Base</p>
                    </div>
                    <Package size={40} className="opacity-40" />
                </header>

                <div className="p-8 space-y-8">
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                <div className="relative">
                                    <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">Nombre del responsable</label>
                                    <input
                                        className="w-full rounded-md border-2 border-slate-400 bg-white px-4 py-3 text-sm font-bold focus:border-[#00677F] focus:outline-none"
                                        placeholder="Buscar empleado..."
                                        value={form.nombreEmpleado}
                                        onChange={async (e) => {
                                            const val = e.target.value;
                                            updateField("nombreEmpleado", val);
                                            if (val.length < 2) return setUsuarios([]);
                                            setBuscando(true);
                                            try { const d = await buscarUsuariosApi(val); setUsuarios(d); } finally { setBuscando(false); }
                                        }}
                                    />
                                    {usuarios.length > 0 && (
                                        <ul className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-white shadow-2xl divide-y">
                                            {usuarios.map((u) => (
                                                <li key={u.id} onClick={() => { updateField("nombreEmpleado", u.name); setUsuarios([]); }} className="cursor-pointer px-4 py-2 hover:bg-blue-50">
                                                    <div className="font-bold text-sm text-slate-700">{u.name}</div>
                                                    <div className="text-[10px] text-slate-500 uppercase">{u.puesto}</div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">Fecha de Turno</label>
                                    <input type="date" className="w-full rounded-md border-2 border-slate-400 bg-white px-4 py-3 text-sm font-bold focus:border-[#00677F] focus:outline-none" value={form.fecha} onChange={(e) => updateField("fecha", e.target.value)} />
                                </div>
                            </div>
                            <ResibeTurnoCon form={form} updateField={updateField} />
                        </div>
                    )}

                    {step === 2 && <div className="animate-in fade-in duration-500"><RevisionSalas form={form} updateField={updateField} /></div>}
                    {step === 3 && <div className="animate-in fade-in duration-500"><HotTrasComiCoor form={form} updateField={updateField} /></div>}
                    {step === 4 && <div className="animate-in fade-in duration-500"><EntregaTurnoCon form={form} updateField={updateField} /></div>}

                    {step === 5 && (
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 animate-in fade-in duration-500">
                            <div className="space-y-4">
                                <div>
                                    <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">Total Operaciones</label>
                                    <input type="number" className="w-full rounded-md border-2 border-slate-400 px-4 py-3 text-sm font-bold focus:border-[#00677F]" value={form.cantidad_operaciones} onChange={(e) => updateField("cantidad_operaciones", e.target.value)} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">Total Pasajeros</label>
                                    <input type="number" className="w-full rounded-md border-2 border-slate-400 px-4 py-3 text-sm font-bold focus:border-[#00677F]" value={form.cantidad_pasajeros} onChange={(e) => updateField("cantidad_pasajeros", e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">Confirmación de Recibido</label>
                                <FirmaBox label="Firma Autorizada" value={form.firma} onClick={() => setOpenFirma("firma_validacion")} />
                                <FirmaCanvas open={openFirma === "firma_validacion"} title="Firma de Entrega" value={form.firma} onClose={() => setOpenFirma(null)} onChange={(b64: string) => updateField("firma", b64)} />
                            </div>
                        </div>
                    )}

                    <footer className="flex justify-between border-t border-slate-100 pt-6">
                        <button
                            type="button"
                            onClick={() => setStep(s => Math.max(1, s - 1))}
                            className={`rounded-md px-8 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${step === 1 ? "invisible" : "border-2 border-slate-200 text-slate-400 hover:bg-slate-50"}`}
                        >
                            Anterior
                        </button>

                        {step < totalSteps ? (
                            <button
                                key="btn-next" // Usar keys ayuda a React a no confundir los botones
                                type="button"
                                onClick={() => {
                                    if (validarPaso(form, step)) setStep(s => s + 1);
                                }}
                                className="rounded-md bg-[#00677F] px-10 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg hover:bg-[#004B5C]"
                            >
                                Siguiente Paso
                            </button>
                        ) : (
                            <button
                                key="btn-submit"
                                type="submit"
                                className={`rounded-md px-10 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all ${isEdit ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"}`}
                            >
                                {isEdit ? "Actualizar Registro" : "Finalizar Entrega"}
                            </button>
                        )}
                    </footer>
                </div>
            </form>
        </>
    );
}
