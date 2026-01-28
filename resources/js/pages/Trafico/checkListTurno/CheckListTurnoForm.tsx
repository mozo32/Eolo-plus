import { useState, useEffect } from "react";
import ResibeTurnoCon from "./sections/ResibeTurnoCon";
import RevisionSalas from "./sections/RevisionSalas";
import HotTrasComiCoor from "./sections/HotTrasComiCoor";
import EntregaTurnoCon from "./sections/EntregaTurnoCon";
import { validarPaso } from "./Validacion";
import FirmaCanvas from "@/pages/FirmaCanvas";
import { guardarCheckListTurnoApi, actualizarCheckListTurnoApi, buscarUsuariosApi } from "@/stores/apiCheckListTurno";
import Swal from "sweetalert2";
function FirmaBox({
    label,
    value,
    onClick,
}: {
    label: string;
    value?: string;
    onClick: () => void;
}) {
    return (
        <div
            onClick={onClick}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 hover:border-orange-500 hover:bg-orange-50"
        >
            <span className="mb-2 text-xs font-bold uppercase text-slate-600">
                {label}
            </span>

            {value ? (
                <img
                    src={value}
                    alt={label}
                    className="h-24 w-full object-contain"
                />
            ) : (
                <span className="text-sm text-slate-400">
                    Toca para firmar
                </span>
            )}
        </div>
    );
}

type Props = {
    isEdit: boolean;
    data?: any;
    open: boolean;
    onSuccess?: () => void;
};

const getInitialForm = (data?: any) => ({
    nombreEmpleado: data?.nombre_empleado ?? "",
    fecha: data?.fecha ?? new Date().toISOString().split("T")[0],
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
export default function CheckListTurnoForm({
    isEdit,
    data,
    open,
    onSuccess,
}: Props) {

    const [step, setStep] = useState(1);
    const totalSteps = 5;
    const [buscando, setBuscando] = useState(false);
    const [usuarios, setUsuarios] = useState<any[]>([]);
    const [openFirma, setOpenFirma] = useState<
        null | "firma_validacion"
    >(null);
    const [form, setForm] = useState(() => getInitialForm(data));
    useEffect(() => {
        setForm(getInitialForm(isEdit ? data : undefined));
        setStep(1);
        setOpenFirma(null);
    }, [data, isEdit]);
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
        const isValid = validarPaso(form, step);

        if (!isValid) return;

        if (step < totalSteps) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const isValid = validarPaso(form, step);
        if (!isValid) return;

        try {
            Swal.fire({ title: "Procesando...", didOpen: () => Swal.showLoading() });

            if (isEdit && data?.id) {
                await actualizarCheckListTurnoApi(data.id, form);

            } else {
                await guardarCheckListTurnoApi(form);
            }

            Swal.fire({
                icon: "success",
                title: isEdit ? "Checklist actualizado" : "Checklist guardado",
            });

            onSuccess?.();
            setStep(1);

        } catch (error: any) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: error?.message || "Error al guardar",
            });
        }
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
                        <div className="relative">
                            <label className="mb-1 block text-xs font-extrabold uppercase tracking-widest text-slate-600">
                                Nombre del empleado
                            </label>
                            <input
                                className="w-full rounded-md border-2 border-slate-400 bg-white px-4 py-3 text-sm font-bold focus:border-[#00677F] focus:outline-none"
                                placeholder="Nombre completo"
                                value={form.nombreEmpleado}
                                onChange={async (e) => {
                                    const value = e.target.value;
                                    updateField("nombreEmpleado", e.target.value)

                                    if (value.length < 2) {
                                        setUsuarios([]);
                                        return;
                                    }

                                    setBuscando(true);
                                    try {
                                        const data = await buscarUsuariosApi(value);
                                        setUsuarios(data);
                                    } finally {
                                        setBuscando(false);
                                    }
                                }}
                            />
                            {usuarios.length > 0 && (
                                <ul
                                    className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl divide-y"
                                >
                                    {usuarios.map((u) => (
                                        <li
                                            key={u.id}
                                            onClick={() => {
                                                updateField("nombreEmpleado", u.name);
                                                setUsuarios([]);
                                            }}
                                            className="cursor-pointer px-4 py-3 text-sm hover:bg-orange-50 transition"
                                        >
                                            <div className="font-semibold text-slate-700">
                                                {u.name}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {u.clave} · {u.puesto}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {buscando && (
                                <div className="absolute right-3 top-10 text-xs text-slate-400">
                                    Buscando…
                                </div>
                            )}
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
                        <FirmaBox
                            label="Firma de Recibido"
                            value={form.firma}
                            onClick={() => setOpenFirma("firma_validacion")}
                        />
                        <FirmaCanvas
                            open={openFirma === "firma_validacion"}
                            title="Firma de Recibido"
                            value={form.firma}
                            onClose={() => setOpenFirma(null)}
                            onChange={(b64: string) =>
                                updateField("firma", b64)
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
                        className={`rounded-md px-8 py-2 text-sm font-bold text-white ${isEdit ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"
                            }`}
                    >
                        {isEdit ? "Actualizar Checklist" : "Guardar Checklist"}
                    </button>
                )}
            </div>
        </form>
    );
}
