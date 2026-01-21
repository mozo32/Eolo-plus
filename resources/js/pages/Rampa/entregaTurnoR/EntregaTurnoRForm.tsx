import { useState } from "react";
import Encabezado from "./sections/Encabezado";
import EquipoComunicaciones from "./sections/EquipoComunicaciones";
import Vehiculos from "./sections/Vehiculos";
import BarrasRemolque from "./sections/BarrasRemolque";
import GPUs from "./sections/GPUs";
import CarritoGolf from "./sections/CarritoGolf";
import Aeronaves from "./sections/Aeronaves";
import Firmas from "./sections/Firmas";
import Acciones from "./sections/Acciones";

export default function EntregaTurnoRForm() {
    const [step, setStep] = useState(1);
    const totalSteps = 5;
    const [form, setForm] = useState({
        encabezado: {
            fecha: "",
            jefeTurno: "",
        },
        comunicaciones: {
            radios: "",
            radioFrecuencia: "",
            radiosFuncionando: true,
        },
        vehiculos: {
            nissan012: { limpieza: "", nivel: "", llantas: "", frenos: "", obs: "" },
            nissan015: { limpieza: "", nivel: "", llantas: "", frenos: "", obs: "" },
            tractor005: { limpieza: "", nivel: "", llantas: "", frenos: "", obs: "" },
            lektro003: { limpieza: "", nivel: "", llantas: "", frenos: "", obs: "" },
            lektro007: { limpieza: "", nivel: "", llantas: "", frenos: "", obs: "" },
            aguasNegras008: { limpieza: "", llantas: "", obs: "" },
        },

        barrasRemolque: {
            total: "",
            limpieza: "",
            estado: "",
            cabezales: "",
            cabezalesEstado: "",
            escalerasCantidad: "",
            escalerasEstado: "",
            hamburgueseraLimpieza: "",
            hamburgueseraLlantas: "",
        },

        gpus: {
            total: "",
            limpias: "",
            voltaje: "",
            enchufe: "",
            llantas: "",
            detalle: {
                hobart600: { limpia: "", voltaje: "", numero: "", enchufe: "", llantas: "" },
                foxtronics: { limpia: "", voltaje: "", numero: "", enchufe: "", llantas: "" },
            },
        },
        carritoGolf: {
            "004": { limpieza: "", carga: "", llantas: "", luces: "", frenos: "", obs: "" },
            "006": { limpieza: "", carga: "", llantas: "", luces: "", frenos: "", obs: "" },
            "005": { limpieza: "", carga: "", llantas: "", luces: "", frenos: "", obs: "" },
        },
        aeronaves: {
            total: "",
            h1: "",
            h2: "",
        },
    });
    const nextStep = () => {
        if (step < totalSteps) setStep(step + 1);
    };

    const prevStep = () => {
        if (step > 1) setStep(step - 1);
    };

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log(form);
    };

    return (
        <form
            className="mx-auto max-w-6xl space-y-6"
            onSubmit={handleSubmit}
        >
            {/* INDICADOR DE PASO */}
            <div className="flex items-center justify-between rounded-lg border bg-slate-50 px-4 py-2 text-sm font-bold">
                <span>Paso {step} de {totalSteps}</span>
                <div className="flex gap-2">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <div
                            key={i}
                            className={`h-2 w-6 rounded-full ${step === i + 1
                                    ? "bg-orange-600"
                                    : "bg-slate-300"
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* ===== STEP 1 ===== */}
            {step === 1 && (
                <>
                    <Encabezado form={form} updateField={updateField} />
                    <EquipoComunicaciones form={form} updateField={updateField} />
                </>
            )}

            {/* ===== STEP 2 ===== */}
            {step === 2 && (
                <Vehiculos form={form} updateField={updateField} />
            )}

            {/* ===== STEP 3 ===== */}
            {step === 3 && (
                <>
                    <BarrasRemolque form={form} updateField={updateField} />
                    <GPUs form={form} updateField={updateField} />
                </>
            )}

            {/* ===== STEP 4 ===== */}
            {step === 4 && (
                <CarritoGolf form={form} updateField={updateField} />
            )}

            {/* ===== STEP 5 ===== */}
            {step === 5 && (
                <>
                    <Aeronaves form={form} updateField={updateField} />
                    <Firmas />
                </>
            )}

            {/* ===== NAVEGACIÓN ===== */}
            <div className="flex justify-between pt-4">
                {step > 1 && (
                    <button
                        type="button"
                        onClick={prevStep}
                        className="rounded-lg border px-4 py-2 text-sm"
                    >
                        Anterior
                    </button>
                )}

                {step < totalSteps && (
                    <button
                        type="button"
                        onClick={nextStep}
                        className="rounded-lg bg-orange-600 px-6 py-2 text-sm font-semibold text-white hover:bg-orange-700"
                    >
                        Siguiente
                    </button>
                )}

                {step === totalSteps && (
                    <button
                        type="submit"
                        className="rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700"
                    >
                        Guardar Entrega
                    </button>
                )}
            </div>
        </form>
    );
}
