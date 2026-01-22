import { useState } from "react";

export default function ServicioComisariatoForm() {
    const [form, setForm] = useState({
        catering: "",
        formaPago: "",
        fechaEntrega: "",
        horaEntrega: "",
        matricula: "",
        detalle: "",
        solicitadoPor: "",
        atendio: "",
        subtotal: "",
        total: "",
    });

    const updateField = (key: string, value: any) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("SERVICIO COMISARIATO:", form);
    };

    /* ================= ESTILOS ================= */
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
            {/* ================= HEADER ================= */}
            <div className="flex items-center justify-between rounded-lg bg-[#00677F] px-6 py-4 text-white">
                <h2 className="text-lg font-extrabold uppercase tracking-wide">
                    Servicio de Comisariato
                </h2>
                <span className="text-xs opacity-80">Área Operativa</span>
            </div>

            {/* ================= DATOS GENERALES ================= */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-xl border bg-slate-50 p-5">
                    <h4 className="mb-4 text-xs font-extrabold uppercase tracking-widest text-[#00677F]">
                        Datos del servicio
                    </h4>

                    <div className="space-y-4">
                        <input
                            className={input}
                            placeholder="Catering"
                            value={form.catering}
                            onChange={(e) =>
                                updateField("catering", e.target.value)
                            }
                        />

                        <input
                            className={input}
                            placeholder="Forma de pago"
                            value={form.formaPago}
                            onChange={(e) =>
                                updateField("formaPago", e.target.value)
                            }
                        />

                        <input
                            className={input}
                            placeholder="Matrícula"
                            value={form.matricula}
                            onChange={(e) =>
                                updateField("matricula", e.target.value)
                            }
                        />
                    </div>
                </div>

                <div className="rounded-xl border bg-slate-50 p-5">
                    <h4 className="mb-4 text-xs font-extrabold uppercase tracking-widest text-[#00677F]">
                        Entrega
                    </h4>

                    <div className="space-y-4">
                        <input
                            type="date"
                            className={input}
                            value={form.fechaEntrega}
                            onChange={(e) =>
                                updateField("fechaEntrega", e.target.value)
                            }
                        />

                        <input
                            type="time"
                            className={input}
                            value={form.horaEntrega}
                            onChange={(e) =>
                                updateField("horaEntrega", e.target.value)
                            }
                        />
                    </div>
                </div>
            </div>

            {/* ================= DETALLE ================= */}
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

            {/* ================= RESUMEN ================= */}
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
                    Guardar Servicio
                </button>
            </div>
        </form>
    );
}
