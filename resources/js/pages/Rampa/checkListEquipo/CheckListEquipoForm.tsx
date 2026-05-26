import { useState, useEffect } from "react";
import { usePage } from "@inertiajs/react";
import { guardarCheckListEquipoSeguridadApi, buscarUsuariosApi, actualizarCheckListEquipoApi, fetchCheckUser } from "@/stores/apiCheckListEquipoSeguridad";
import Swal from "sweetalert2";
import { User, ShieldCheck, XCircle, AlertCircle, Package } from "lucide-react";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const EQUIPOS = ["Lentes", "Guantes", "Chaleco", "Botas de seguridad", "Rodilleras", "Fajas", "wandas de pvc", "wandas luces", "Botas de hule", "impermeable pantalón", "impermeable chamarra", "silbato", "tapones auditivos"];

const NIVELES_DESGASTE = [
    { value: "Nuevo", label: "Nuevo", color: "bg-emerald-500" },
    { value: "Buen Estado", label: "Óptimo", color: "bg-blue-500" },
    { value: "Desgastado", label: "Desgastado", color: "bg-amber-500" },
    { value: "Mal Estado", label: "Crítico", color: "bg-red-500" }
];

const now = new Date();
const MES_ACTUAL = MESES[now.getMonth()];

export default function ChecklistDualForm({ isEdit, data, onSuccess }: { isEdit: boolean, data?: any, onSuccess?: () => void }) {
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [bloqueado, setBloqueado] = useState(false);
    const [form, setForm] = useState({
        user_id: data?.user_id ?? "",
        nombre: data?.nombre ?? "",
        checklist: data?.checklist ?? {}, // Guardará: { "Enero": { "Lentes": { tiene: true, estado: "Nuevo" } } }
        observaciones: data?.observaciones ?? ""
    });

    const handleToggleTiene = (eq: string) => {
        const actual = form.checklist[MES_ACTUAL]?.[eq] || { tiene: false, estado: "" };
        const nuevoTiene = !actual.tiene;

        setForm(prev => ({
            ...prev,
            checklist: {
                ...prev.checklist,
                [MES_ACTUAL]: {
                    ...(prev.checklist[MES_ACTUAL] || {}),
                    [eq]: { tiene: nuevoTiene, estado: nuevoTiene ? (actual.estado || "Buen Estado") : "" }
                }
            }
        }));
    };

    const handleEstadoChange = (eq: string, estado: string) => {
        setForm(prev => ({
            ...prev,
            checklist: {
                ...prev.checklist,
                [MES_ACTUAL]: {
                    ...(prev.checklist[MES_ACTUAL] || {}),
                    [eq]: { ...prev.checklist[MES_ACTUAL][eq], estado }
                }
            }
        }));
    };

    return (
        <div className="min-h-screen bg-[#F0F2F5] p-4 lg:p-12 font-sans">
            <div className="max-w-5xl mx-auto">

                {/* --- SECCIÓN SUPERIOR: IDENTIFICACIÓN --- */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden mb-8">
                    <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-8 text-white">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 bg-white/10 rounded-2xl backdrop-blur-md flex items-center justify-center border border-white/20">
                                    <Package size={28} className="text-blue-400" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black tracking-tight">Control de Activos EPP</h1>
                                    <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">{MES_ACTUAL} 2026</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-xs font-bold tracking-tighter uppercase">Modo Auditoría</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <div className="relative">
                                <label className="text-[11px] font-black text-slate-400 uppercase ml-1 block mb-2">Empleado</label>
                                <div className="relative">
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                        placeholder="Nombre del trabajador..."
                                        value={form.nombre}
                                        onChange={(e) => setForm({...form, nombre: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="hidden md:block">
                                <div className="flex gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                    <InfoCircle className="text-blue-500" size={20} />
                                    <p className="text-xs text-blue-700 leading-relaxed font-medium">
                                        Marque si el empleado <b>porta el equipo</b> y luego califique su condición actual.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- LISTA DE REVISIÓN DUAL --- */}
                <div className="grid grid-cols-1 gap-4">
                    {EQUIPOS.map((eq) => {
                        const item = form.checklist[MES_ACTUAL]?.[eq] || { tiene: false, estado: "" };

                        return (
                            <div key={eq} className={`group transition-all duration-300 rounded-3xl border-2 ${item.tiene ? 'bg-white border-blue-100 shadow-lg shadow-blue-50' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="p-5 flex flex-col md:flex-row items-center justify-between gap-6">

                                    {/* Toggle: ¿Lo tiene? */}
                                    <div className="flex items-center gap-4 w-full md:w-1/3">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleTiene(eq)}
                                            className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${item.tiene ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400 hover:bg-slate-300'}`}
                                        >
                                            {item.tiene ? <ShieldCheck size={24} /> : <XCircle size={24} />}
                                        </button>
                                        <div>
                                            <h3 className={`font-black text-sm uppercase tracking-tight ${item.tiene ? 'text-slate-800' : 'text-slate-400'}`}>{eq}</h3>
                                            <span className={`text-[10px] font-bold uppercase ${item.tiene ? 'text-blue-500' : 'text-slate-400'}`}>
                                                {item.tiene ? 'En posesión' : 'No entregado / No porta'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Selector de Desgaste: Solo se ve si 'tiene' es true */}
                                    <div className={`flex-1 w-full transition-all duration-500 ${item.tiene ? 'opacity-100 translate-x-0' : 'opacity-20 pointer-events-none translate-x-4 grayscale'}`}>
                                        <div className="flex flex-wrap md:flex-nowrap gap-2 bg-slate-100 p-1.5 rounded-2xl">
                                            {NIVELES_DESGASTE.map((n) => (
                                                <button
                                                    key={n.value}
                                                    type="button"
                                                    onClick={() => handleEstadoChange(eq, n.value)}
                                                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                                        item.estado === n.value
                                                        ? `${n.color} text-white shadow-md shadow-slate-200 scale-[1.02]`
                                                        : 'bg-transparent text-slate-500 hover:bg-white/50'
                                                    }`}
                                                >
                                                    {n.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* --- FOOTER: OBSERVACIONES --- */}
                <div className="mt-8 bg-white p-8 rounded-3xl border-2 border-slate-100 shadow-xl">
                    <div className="flex items-center gap-2 mb-4">
                        <AlertCircle className="text-slate-400" size={20} />
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Hallazgos Especiales</h3>
                    </div>
                    <textarea
                        className="w-full bg-slate-50 rounded-2xl p-5 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500 transition-all border-none min-h-[120px]"
                        placeholder="Describa faltantes o mal uso detectado..."
                        value={form.observaciones}
                        onChange={(e) => setForm({...form, observaciones: e.target.value})}
                    />

                    <div className="mt-8 flex justify-end">
                        <button className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-200 transition-all active:scale-95">
                            Finalizar Reporte Mensual
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Icono auxiliar
function InfoCircle({className, size}: {className?: string, size?: number}) {
    return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
}
