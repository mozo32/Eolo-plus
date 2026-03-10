import { validarServicioComisariato } from "./validacion";
import { useState, useEffect } from "react";
import { guardarServicioComisariatoApi, actualizarServicioComisariatoApi } from "@/stores/apiServicioComisariato";
import Swal from "sweetalert2";
import { Package } from "lucide-react";

type Props = {
    isEdit: boolean;
    data?: any;
    open: boolean;
    onSuccess?: () => void;
};

const getInitialForm = (data?: any) => ({
    catering: data?.catering ?? "",
    formaPago: data?.forma_pago ?? "",
    fechaEntrega: data?.fecha_entrega
        ? data.fecha_entrega.split("T")[0]
        : new Date().toISOString().split("T")[0],
    horaEntrega: data?.hora_entrega ?? "",
    matricula: data?.matricula ?? "",
    detalle: data?.detalle ?? "",
    solicitadoPor: data?.solicitado_por ?? "",
    atendio: data?.atendio ?? "",
    subtotal: data?.subtotal ?? "",
    total: data?.total ?? "",
});

export default function ServicioComisariatoForm({ isEdit, data, onSuccess }: Props) {
    const [form, setForm] = useState(() => getInitialForm(data));

    useEffect(() => {
        setForm(getInitialForm(isEdit ? data : undefined));
    }, [data, isEdit]);

    const updateField = (key: string, value: any, forceUpper: boolean = false) => {
        const finalValue = (forceUpper && typeof value === 'string') ? value.toUpperCase() : value;
        setForm((prev) => ({ ...prev, [key]: finalValue }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { valid, errores } = validarServicioComisariato(form);

        if (!valid) {
            Swal.fire({
                icon: "warning",
                title: "Formulario incompleto",
                html: `<ul style="text-align:left">${errores.map(e => `<li>• ${e}</li>`).join("")}</ul>`,
            });
            return;
        }

        try {
            Swal.fire({ title: "Procesando...", didOpen: () => Swal.showLoading() });
            if (isEdit && data?.id) {
                await actualizarServicioComisariatoApi(data.id, form);
            } else {
                await guardarServicioComisariatoApi(form);
            }
            Swal.fire({
                icon: "success",
                title: isEdit ? "Servicio actualizado" : "Servicio Guardado"
            });
            onSuccess?.();
        } catch (error: any) {
            Swal.fire({ icon: "error", title: "Error", text: error?.message || "Error al guardar" });
        }
    };

    const inputStyle = "w-full rounded-lg border-2 border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#00677F] focus:bg-white focus:ring-2 focus:ring-[#00677F]/20 focus:outline-none";
    const labelStyle = "mb-1 block text-xs font-extrabold uppercase text-slate-600";
    const sectionTitle = "mb-4 text-xs font-extrabold uppercase tracking-widest text-[#00677F]";

    return (
        <div className="mx-auto max-w-5xl bg-slate-50 shadow-xl rounded-xl overflow-hidden border border-slate-200">
            <header className="bg-[#1e3a8a] p-8 text-white flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-tighter">
                        {isEdit ? "Edición de Comisariato" : "Nuevo Registro de Comisariato"}
                    </h1>
                    <p className="text-xs opacity-70 font-bold uppercase tracking-[0.2em]">Logística Operativa</p>
                </div>
                <Package size={36} className="opacity-30" />
            </header>
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="border bg-slate-50 p-5 space-y-4">
                        <h4 className={sectionTitle}>Datos del servicio</h4>

                        <div>
                            <label className={labelStyle}>Catering</label>
                            <input className={inputStyle} value={form.catering} onChange={(e) => updateField("catering", e.target.value)} placeholder="Proveedor" />
                        </div>

                        <div>
                            <label className={labelStyle}>Matrícula</label>
                            <input className={`${inputStyle} text-blue-800`} value={form.matricula} onChange={(e) => updateField("matricula", e.target.value, true)} placeholder="XA-XXX" />
                        </div>

                        <div>
                            <label className={labelStyle}>Forma de Pago</label>
                            <input className={inputStyle} value={form.formaPago} onChange={(e) => updateField("formaPago", e.target.value)} />
                        </div>
                    </div>
                    <div className="border bg-slate-50 p-5 space-y-4">
                        <h4 className={sectionTitle}>Programación de Entrega</h4>

                        <div>
                            <label className={labelStyle}>Fecha de entrega</label>
                            <input type="date" className={inputStyle} value={form.fechaEntrega} onChange={(e) => updateField("fechaEntrega", e.target.value)} />
                        </div>

                        <div>
                            <label className={labelStyle}>Hora de entrega (24H)</label>
                            <input
                                type="time"
                                className={`${inputStyle} text-center text-lg`}
                                value={form.horaEntrega}
                                onChange={(e) => updateField("horaEntrega", e.target.value)}
                                required
                            />
                            <p className="mt-1 text-[10px] font-bold text-slate-400 italic">Formato Militar 24 Horas</p>
                        </div>
                    </div>
                </div>
                <div className=" border bg-white p-6">
                    <h4 className={sectionTitle}>Detalle del servicio</h4>
                    <textarea
                        className="w-full min-h-[120px] rounded-lg border-2 border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 shadow-sm focus:border-[#00677F] focus:bg-white focus:outline-none"
                        placeholder="Describa el servicio solicitado..."
                        value={form.detalle}
                        onChange={(e) => updateField("detalle", e.target.value)}
                    />
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-4 rounded-xl border bg-slate-50 p-5">
                    <div>
                        <label className={labelStyle}>Solicitado por</label>
                        <input className={inputStyle} placeholder="Nombre" value={form.solicitadoPor} onChange={(e) => updateField("solicitadoPor", e.target.value)} />
                    </div>
                    <div>
                        <label className={labelStyle}>Atendió</label>
                        <input className={inputStyle} placeholder="Nombre" value={form.atendio} onChange={(e) => updateField("atendio", e.target.value)} />
                    </div>
                    <div>
                        <label className={labelStyle}>Subtotal</label>
                        <input type="number" className={inputStyle} placeholder="0.00" value={form.subtotal} onChange={(e) => updateField("subtotal", e.target.value)} />
                    </div>
                    <div>
                        <label className={labelStyle}>Total Final</label>
                        <input type="number" className={`${inputStyle} font-extrabold text-[#00677F]`} placeholder="0.00" value={form.total} onChange={(e) => updateField("total", e.target.value)} />
                    </div>
                </div>
                <div className="flex justify-end">
                    <button
                        type="submit"
                        className="rounded-lg bg-[#00677F] px-12 py-4 text-sm font-extrabold uppercase tracking-widest text-white transition-colors hover:bg-[#00586D] shadow-md active:scale-95"
                    >
                        {isEdit ? "Actualizar Registro" : "Guardar Registro"}
                    </button>
                </div>
            </form>
        </div>
    );
}
