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

const limpiarMonto = (value: any) => {
    return String(value ?? "").replace(/,/g, "");
};

const formatearMonto = (value: any) => {
    const limpio = limpiarMonto(value).replace(/[^\d.]/g, "");

    if (!limpio) return "";

    const partes = limpio.split(".");
    const entero = partes[0];
    const decimal = partes.length > 1 ? partes[1].slice(0, 2) : "";

    const enteroFormateado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    return partes.length > 1 ? `${enteroFormateado}.${decimal}` : enteroFormateado;
};

const formatearHora24 = (value: string) => {
    const numeros = value.replace(/\D/g, "").slice(0, 4);

    if (numeros.length <= 2) {
        return numeros;
    }

    return `${numeros.slice(0, 2)}:${numeros.slice(2)}`;
};

const normalizarHora24 = (value: string) => {
    if (!value) return "";

    const match = value.match(/^(\d{1,2}):?(\d{0,2})$/);

    if (!match) return value;

    let horas = match[1] ?? "";
    let minutos = match[2] ?? "";

    if (horas.length === 1) {
        horas = `0${horas}`;
    }

    if (minutos.length === 0) {
        minutos = "00";
    }

    if (minutos.length === 1) {
        minutos = `${minutos}0`;
    }

    const h = Math.min(Math.max(Number(horas), 0), 23);
    const m = Math.min(Math.max(Number(minutos), 0), 59);

    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const getInitialForm = (data?: any) => ({
    catering: data?.catering ?? "",
    formaPago: data?.forma_pago ?? "",
    fechaEntrega: data?.fecha_entrega
        ? data.fecha_entrega.split("T")[0]
        : new Date().toISOString().split("T")[0],
    horaEntrega: data?.hora_entrega ? String(data.hora_entrega).slice(0, 5) : "",
    matricula: data?.matricula ?? "",
    detalle: data?.detalle ?? "",
    solicitadoPor: data?.solicitado_por ?? "",
    atendio: data?.atendio ?? "",
    subtotal: formatearMonto(data?.subtotal ?? ""),
    total: formatearMonto(data?.total ?? ""),
});

export default function ServicioComisariatoForm({ isEdit, data, onSuccess }: Props) {
    const [form, setForm] = useState(() => getInitialForm(data));

    useEffect(() => {
        setForm(getInitialForm(isEdit ? data : undefined));
    }, [data, isEdit]);

    const updateField = (key: string, value: any, forceUpper: boolean = false) => {
        const finalValue = forceUpper && typeof value === "string" ? value.toUpperCase() : value;
        setForm((prev) => ({ ...prev, [key]: finalValue }));
    };

    const updateMonto = (key: "subtotal" | "total", value: string) => {
        setForm((prev) => ({
            ...prev,
            [key]: formatearMonto(value),
        }));
    };

    const updateHora = (value: string) => {
        setForm((prev) => ({
            ...prev,
            horaEntrega: formatearHora24(value),
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const formParaValidar = {
            ...form,
            subtotal: limpiarMonto(form.subtotal),
            total: limpiarMonto(form.total),
        };

        const { valid, errores } = validarServicioComisariato(formParaValidar);

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

            const payload = {
                ...form,
                subtotal: limpiarMonto(form.subtotal),
                total: limpiarMonto(form.total),
                horaEntrega: normalizarHora24(form.horaEntrega),
            };

            if (isEdit && data?.id) {
                await actualizarServicioComisariatoApi(data.id, payload);
            } else {
                await guardarServicioComisariatoApi(payload);
            }

            Swal.fire({
                icon: "success",
                title: isEdit ? "Servicio actualizado" : "Servicio Guardado",
            });

            onSuccess?.();
        } catch (error: any) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: error?.message || "Error al guardar",
            });
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
                    <p className="text-xs opacity-70 font-bold uppercase tracking-[0.2em]">
                        Logística Operativa
                    </p>
                </div>
                <Package size={36} className="opacity-30" />
            </header>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="border bg-slate-50 p-5 space-y-4">
                        <h4 className={sectionTitle}>Datos del servicio</h4>

                        <div>
                            <label className={labelStyle}>Catering</label>
                            <input
                                className={inputStyle}
                                value={form.catering}
                                onChange={(e) => updateField("catering", e.target.value)}
                                placeholder="Proveedor"
                            />
                        </div>

                        <div>
                            <label className={labelStyle}>Matrícula</label>
                            <input
                                className={`${inputStyle} text-blue-800`}
                                value={form.matricula}
                                onChange={(e) => updateField("matricula", e.target.value, true)}
                                placeholder="XA-XXX"
                            />
                        </div>

                        <div>
                            <label className={labelStyle}>Forma de Pago</label>
                            <input
                                className={inputStyle}
                                value={form.formaPago}
                                onChange={(e) => updateField("formaPago", e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="border bg-slate-50 p-5 space-y-4">
                        <h4 className={sectionTitle}>Programación de Entrega</h4>

                        <div>
                            <label className={labelStyle}>Fecha de entrega</label>
                            <input
                                type="date"
                                className={inputStyle}
                                value={form.fechaEntrega}
                                onChange={(e) => updateField("fechaEntrega", e.target.value)}
                            />
                        </div>

                        <div>
                            <label className={labelStyle}>Hora de entrega (24H)</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                maxLength={5}
                                placeholder="HH:MM"
                                className={`${inputStyle} text-center text-lg`}
                                value={form.horaEntrega}
                                onChange={(e) => updateHora(e.target.value)}
                                onBlur={(e) => updateField("horaEntrega", normalizarHora24(e.target.value))}
                                required
                            />
                            <p className="mt-1 text-[10px] font-bold text-slate-400 italic">
                                Escriba la hora en formato 24 horas, ejemplo 13:45
                            </p>
                        </div>
                    </div>
                </div>

                <div className="border bg-white p-6">
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
                        <input
                            className={inputStyle}
                            placeholder="Nombre"
                            value={form.solicitadoPor}
                            onChange={(e) => updateField("solicitadoPor", e.target.value)}
                        />
                    </div>

                    <div>
                        <label className={labelStyle}>Atendió</label>
                        <input
                            className={inputStyle}
                            placeholder="Nombre"
                            value={form.atendio}
                            onChange={(e) => updateField("atendio", e.target.value)}
                        />
                    </div>

                    <div>
                        <label className={labelStyle}>Subtotal</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            className={inputStyle}
                            placeholder="0.00"
                            value={form.subtotal}
                            onChange={(e) => updateMonto("subtotal", e.target.value)}
                        />
                    </div>

                    <div>
                        <label className={labelStyle}>Total Final</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            className={`${inputStyle} font-extrabold text-[#00677F]`}
                            placeholder="0.00"
                            value={form.total}
                            onChange={(e) => updateMonto("total", e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex justify-end p-5">
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
