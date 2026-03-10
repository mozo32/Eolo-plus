import { useState, useEffect } from "react";
import { usePage } from "@inertiajs/react";
import { guardarCheckListEquipoSeguridadApi, buscarUsuariosApi, actualizarCheckListEquipoApi, fetchCheckUser } from "@/stores/apiCheckListEquipoSeguridad";
import Swal from "sweetalert2";
import { User } from "lucide-react";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const EQUIPOS = ["Lentes", "Guantes", "Cascos", "Chaleco", "Botas", "Gorras", "Rodilleras", "Fajas", "Guantes PVC", "Bandas de luces", "Impermeable", "Tenis", "Botas de hule"];

const now = new Date();
const MES_ACTUAL = MESES[now.getMonth()];
const ANIO_ACTUAL = now.getFullYear();

const getInitialForm = (data?: any) => ({
    user_id: data?.user_id ?? "",
    nombre: data?.nombre ?? "",
    checklist: data?.checklist ?? {},
    observaciones: data?.observaciones ?? "",
});

export default function CheckListEquipoForm({ isEdit, data, onSuccess }: { isEdit: boolean, data?: any, open: boolean, onSuccess?: () => void }) {
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [bloqueado, setBloqueado] = useState(false);
    const [buscando, setBuscando] = useState(false);
    const { auth } = usePage<{ auth: { user: any } }>().props;
    const [form, setForm] = useState(() => getInitialForm(data));

    useEffect(() => {
        setForm(getInitialForm(isEdit ? data : undefined));
    }, [data, isEdit]);

    const toggleEquipo = (equipo: string) => {
        setForm((prev: any) => ({
            ...prev,
            checklist: {
                ...prev.checklist,
                [MES_ACTUAL]: {
                    ...(prev.checklist[MES_ACTUAL] || {}),
                    [equipo]: !prev.checklist?.[MES_ACTUAL]?.[equipo],
                },
            },
        }));
    };

    const consultNombre = async (id: number) => {
        try {
            const res = await fetchCheckUser(id);
            if (res.message) {
                Swal.fire({ icon: res.alreadyCheckedThisMonth ? "info" : "warning", title: "Aviso", text: res.message });
            }
            if (res.data) {
                setForm((prev: any) => ({
                    ...prev,
                    user_id: res.data.user_id,
                    nombre: res.data.nombre,
                    checklist: res.data.checklist || {},
                    observaciones: res.data.observaciones || "",
                }));
            }
            setBloqueado(!!res.alreadyCheckedThisMonth && !auth?.user?.isAdmin);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isEdit && data?.id) {
                await actualizarCheckListEquipoApi(data.id, form);
            } else {
                await guardarCheckListEquipoSeguridadApi(form);
            }
            await Swal.fire({ icon: "success", title: "CheckList guardado" });
            onSuccess?.();
        } catch (error: any) {
            Swal.fire({ icon: "error", title: "Error", text: error?.message || "Error inesperado" });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mx-auto max-w-6xl overflow-hidden rounded-xl border border-slate-300 bg-white shadow-md">
            <header className="bg-[#1e3a8a] text-white p-8 flex justify-between items-center shadow-lg w-full">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-widest">Checklist de Equipo de Seguridad</h1>
                    <p className="text-sm opacity-80 uppercase font-medium">Control de Pernoctas Diarias de Aeronaves</p>
                </div>
                <User size={40} className="opacity-40" />
            </header>

            <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="md:col-span-2 relative">
                        <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">Nombre del empleado</label>
                        <input
                            className="w-full rounded-md border-2 border-slate-400 bg-white px-4 py-3 text-sm font-bold focus:border-[#00677F] focus:outline-none"
                            placeholder="Nombre completo"
                            value={form.nombre}
                            onChange={async (e) => {
                                const value = e.target.value;
                                setForm({ ...form, nombre: value });
                                if (value.length < 2) return setUsuarios([]);
                                setBuscando(true);
                                try {
                                    const d = await buscarUsuariosApi(value);
                                    setUsuarios(d);
                                } finally { setBuscando(false); }
                            }}
                        />
                        {usuarios.length > 0 && (
                            <ul className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-xl">
                                {usuarios.map((u) => (
                                    <li key={u.id} onClick={() => { setForm({ ...form, nombre: u.name, user_id: u.id }); setUsuarios([]); consultNombre(u.id); }} className="cursor-pointer px-4 py-2 hover:bg-blue-50">
                                        <div className="font-bold text-sm">{u.name}</div>
                                        <div className="text-xs text-slate-500">{u.clave} · {u.puesto}</div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="flex flex-col items-center justify-center rounded-md border border-[#00677F] bg-[#E6F2F6] py-3">
                        <span className="text-xs font-bold uppercase text-[#00677F]">Registro {ANIO_ACTUAL}</span>
                        <span className="text-sm font-extrabold uppercase text-[#004B5C]">{MES_ACTUAL}</span>
                    </div>
                </div>

                <div className="rounded-xl border-2 border-[#00677F] bg-[#E6F2F6] p-6">
                    <h3 className="mb-5 text-sm font-extrabold uppercase tracking-widest text-[#00677F]">{MES_ACTUAL} {ANIO_ACTUAL}</h3>
                    {bloqueado && <div className="mb-4 rounded-md border border-blue-400 bg-blue-50 p-3 text-sm text-blue-700">Checklist finalizado para este mes.</div>}
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {EQUIPOS.map((eq) => (
                            <label key={eq} className="flex items-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold cursor-pointer">
                                <input type="checkbox" disabled={bloqueado} checked={!!form.checklist?.[MES_ACTUAL]?.[eq]} onChange={() => toggleEquipo(eq)} className="h-5 w-5 accent-[#00677F]" />
                                {eq}
                            </label>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="mb-2 block text-xs font-extrabold uppercase text-slate-600">Observaciones generales</label>
                    <textarea
                        disabled={bloqueado}
                        className="w-full min-h-[120px] rounded-md border-2 border-slate-400 p-4 text-sm focus:border-[#00677F] focus:outline-none"
                        value={form.observaciones}
                        onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                    />
                </div>

                <div className="flex justify-end pt-4">
                    <button type="submit" disabled={bloqueado} className={`rounded-md px-12 py-4 text-sm font-black uppercase tracking-widest text-white transition-all ${bloqueado ? "bg-slate-300" : "bg-[#00677F] hover:bg-[#004B5C] shadow-lg"}`}>
                        {isEdit ? "Actualizar" : "Guardar"} Checklist
                    </button>
                </div>
            </div>
        </form>
    );
}
