import { validarServicioComisariato } from "./validacion";
import { useState, useEffect } from "react";
import TimePicker24 from "@/pages/TimePicker24";
import { guardarServicioComisariatoApi, actualizarServicioComisariatoApi } from "@/stores/apiServicioComisariato";
import Swal from "sweetalert2";
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
export default function ServicioComisariatoForm({
    isEdit,
    data,
    open,
    onSuccess,
}: Props) {

    const [form, setForm] = useState(() => getInitialForm(data));
    useEffect(() => {
        setForm(getInitialForm(isEdit ? data : undefined));
    }, [data, isEdit]);
    const updateField = (key: string, value: any) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const { valid, errores } = validarServicioComisariato(form);

        if (!valid) {
            Swal.fire({
                icon: "warning",
                title: "Formulario incompleto",
                html: `
                    <ul style="text-align:left">
                        ${errores.map(e => `<li>• ${e}</li>`).join("")}
                    </ul>
                `,
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
                title: isEdit ? "Servicio de Comisariato actualizado" : "Servicio de Comisariato Guardado",
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

    const input =
        "w-full rounded-lg border-2 border-slate-300 bg-slate-50 px-4 py-3 " +
        "text-sm font-semibold text-slate-700 shadow-sm " +
        "placeholder:text-slate-400 " +
        "focus:border-[#00677F] focus:bg-white focus:ring-2 focus:ring-[#00677F]/20 focus:outline-none";

    const textarea =
        "w-full min-h-[200px] rounded-lg border-2 border-slate-300 bg-slate-50 px-4 py-3 " +
        "text-sm font-medium text-slate-700 shadow-sm " +
        "placeholder:text-slate-400 " +
        "focus:border-[#00677F] focus:bg-white focus:ring-2 focus:ring-[#00677F]/20 focus:outline-none";

    return (
        <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-6xl space-y-8 rounded-2xl border border-slate-300 bg-white p-8 shadow-lg"
        >
            <div className="flex items-center justify-between rounded-lg bg-[#00677F] px-6 py-4 text-white">
                <h2 className="text-lg font-extrabold uppercase tracking-wide">
                    Servicio de Comisariato
                </h2>
                <span className="text-xs opacity-80">Área Operativa</span>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-xl border bg-slate-50 p-5">
                    <h4 className="mb-4 text-xs font-extrabold uppercase tracking-widest text-[#00677F]">
                        Datos del servicio
                    </h4>

                    <div className="space-y-4">
                        {/* CATERING */}
                        <div>
                            <label className="mb-1 block text-xs font-extrabold uppercase text-slate-600">
                                Catering
                            </label>
                            <input
                                className={input}
                                value={form.catering}
                                onChange={(e) =>
                                    updateField("catering", e.target.value)
                                }
                            />
                        </div>

                        {/* FORMA DE PAGO */}
                        <div>
                            <label className="mb-1 block text-xs font-extrabold uppercase text-slate-600">
                                Forma de pago
                            </label>
                            <input
                                className={input}
                                value={form.formaPago}
                                onChange={(e) =>
                                    updateField("formaPago", e.target.value)
                                }
                            />
                        </div>

                        {/* MATRÍCULA */}
                        <div>
                            <label className="mb-1 block text-xs font-extrabold uppercase text-slate-600">
                                Matrícula
                            </label>
                            <input
                                className={input}
                                value={form.matricula}
                                onChange={(e) =>
                                    updateField("matricula", e.target.value)
                                }
                            />
                        </div>

                        {/* FECHA ENTREGA */}
                        <div>
                            <label className="mb-1 block text-xs font-extrabold uppercase text-slate-600">
                                Fecha de entrega
                            </label>
                            <input
                                type="date"
                                className={input}
                                value={form.fechaEntrega}
                                onChange={(e) =>
                                    updateField("fechaEntrega", e.target.value)
                                }
                            />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border bg-slate-50 p-5">
                    <h4 className="mb-4 text-xs font-extrabold uppercase tracking-widest text-[#00677F]">
                        Hora de entrega
                    </h4>

                    <div className="space-y-4">


                        <TimePicker24
                            value={form.horaEntrega}
                            onChange={(value) => updateField("horaEntrega", value)}
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-xl border bg-white p-6">
                <h4 className="mb-3 text-xs font-extrabold uppercase tracking-widest text-[#00677F]">
                    Detalle del servicio
                </h4>

                <textarea
                    className={textarea}
                    placeholder="Describa el servicio solicitado..."
                    value={form.detalle}
                    onChange={(e) =>
                        updateField("detalle", e.target.value)
                    }
                />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-4 rounded-xl border bg-slate-50 p-5">
                <input
                    className={input}
                    placeholder="Solicitado por"
                    value={form.solicitadoPor}
                    onChange={(e) =>
                        updateField("solicitadoPor", e.target.value)
                    }
                />

                <input
                    className={input}
                    placeholder="Atendió"
                    value={form.atendio}
                    onChange={(e) =>
                        updateField("atendio", e.target.value)
                    }
                />

                <input
                    type="number"
                    className={input}
                    placeholder="Subtotal"
                    value={form.subtotal}
                    onChange={(e) =>
                        updateField("subtotal", e.target.value)
                    }
                />

                <input
                    type="number"
                    className={`${input} font-extrabold`}
                    placeholder="Total"
                    value={form.total}
                    onChange={(e) =>
                        updateField("total", e.target.value)
                    }
                />
            </div>

            <div className="flex justify-end">
                <button
                    type="submit"
                    className="rounded-lg bg-[#00677F] px-12 py-3 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-[#00586D]"
                >
                    {isEdit ? "Actualizar Servicio" : " Guardar Servicio"}
                </button>
            </div>
        </form>
    );
}
