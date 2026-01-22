import { useState } from "react";
import ResibeTurnoCon from "./sections/ResibeTurnoCon";
import RevisionSalas from "./sections/RevisionSalas";
import HotTrasComiCoor from "./sections/HotTrasComiCoor";
import EntregaTurnoCon from "./sections/EntregaTurnoCon";

export default function CheckListTurnoForm() {
    const [step, setStep] = useState(1);
    const totalSteps = 5;

    const [form, setForm] = useState({
        nombreEmpleado: "",
        fecha: "",
        recibeTurnoCon: {},
        observaciones_recibe: "",
        revisionSalas: {},
        HotTrasComiCoor: [] as any[],
        revision_base_operaciones: false,
        envia_informe_diario: false,
        envia_resumen_semanel: false,
        entregaTurnoCon: {},
        observaciones_entrega: "",
        cantidad_pasajeros: "",
        cantidad_operaciones: "",
        firma: "",
    });

    const updateField = (path: string, value: any) => {
        setForm((prev: any) => {
            const keys = path.split(".");
            const updated = { ...prev };
            let current = updated;

            keys.forEach((key, i) => {
                if (i === keys.length - 1) {
                    current[key] = value;
                } else {
                    current[key] = { ...current[key] };
                    current = current[key];
                }
            });

            return updated;
        });
    };

    const nextStep = () => {
        if (step < totalSteps) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log("CHECKLIST TURNO:", form);
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-6xl space-y-8 rounded-xl border border-slate-300 bg-white p-8 shadow-md"
        >
            <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-4 py-3 text-sm font-bold">
                <span>Paso {step} de {totalSteps}</span>
                <div className="flex gap-2">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <div
                            key={i}
                            className={`h-2 w-8 rounded-full ${step === i + 1
                                ? "bg-[#00677F]"
                                : "bg-slate-300"
                                }`}
                        />
                    ))}
                </div>
            </div>

            {step === 1 && (
                <>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">
                                Nombre del empleado
                            </label>
                            <input
                                className="w-full rounded-md border-2 border-slate-400 bg-white px-4 py-3 text-sm font-bold focus:border-[#00677F] focus:outline-none"
                                placeholder="Nombre completo"
                                value={form.nombreEmpleado}
                                onChange={(e) =>
                                    updateField("nombreEmpleado", e.target.value)
                                }
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">
                                Fecha
                            </label>
                            <input
                                type="date"
                                className="w-full rounded-md border-2 border-slate-400 bg-white px-4 py-3 text-sm font-bold focus:border-[#00677F] focus:outline-none"
                                value={form.fecha}
                                onChange={(e) =>
                                    updateField("fecha", e.target.value)
                                }
                            />
                        </div>
                    </div>

                    <ResibeTurnoCon form={form} updateField={updateField} />
                </>
            )}

            {step === 2 && (
                <RevisionSalas form={form} updateField={updateField} />
            )}

            {step === 3 && (
                <HotTrasComiCoor form={form} updateField={updateField} />
            )}

            {step === 4 && (
                <EntregaTurnoCon form={form} updateField={updateField} />
            )}

            {step === 5 && (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div>
                        <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">
                            Cantidad de Operaciones
                        </label>
                        <input
                            type="number"
                            className="w-full rounded-md border-2 border-slate-400 bg-white px-4 py-3 text-sm font-bold focus:border-[#00677F] focus:outline-none"
                            placeholder="Cantidad"
                            value={form.cantidad_operaciones}
                            onChange={(e) =>
                                updateField("cantidad_operaciones", e.target.value)
                            }
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">
                            Cantidad de Pasajeros
                        </label>
                        <input
                            type="number"
                            className="w-full rounded-md border-2 border-slate-400 bg-white px-4 py-3 text-sm font-bold focus:border-[#00677F] focus:outline-none"
                            value={form.cantidad_pasajeros}
                            placeholder="Cantidad"
                            onChange={(e) =>
                                updateField("cantidad_pasajeros", e.target.value)
                            }
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">
                            Firma
                        </label>
                        <input
                            className="w-full rounded-md border-2 border-slate-400 bg-white px-4 py-3 text-sm font-bold focus:border-[#00677F] focus:outline-none"
                            value={form.firma}
                            placeholder="Nombre Compreto"
                            onChange={(e) =>
                                updateField("firma", e.target.value)
                            }
                        />
                    </div>
                </div>
            )}

            <div className="flex justify-between pt-4">
                {step > 1 && (
                    <button
                        type="button"
                        onClick={prevStep}
                        className="rounded-md border px-6 py-2 text-sm font-bold"
                    >
                        Anterior
                    </button>
                )}

                {step < totalSteps && (
                    <button
                        type="button"
                        onClick={nextStep}
                        className="rounded-md bg-[#00677F] px-8 py-2 text-sm font-bold text-white hover:bg-[#00586D]"
                    >
                        Siguiente
                    </button>
                )}

                {step === totalSteps && (
                    <button
                        type="submit"
                        className="rounded-md bg-green-600 px-8 py-2 text-sm font-bold text-white hover:bg-green-700"
                    >
                        Guardar Checklist
                    </button>
                )}
            </div>
        </form>
    );
}
