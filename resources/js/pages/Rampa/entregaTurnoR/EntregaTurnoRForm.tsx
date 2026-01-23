import { validarStep } from "./validacionEntregaTurnoR";
import { useState, useEffect } from "react";
import Encabezado from "./sections/Encabezado";
import EquipoComunicaciones from "./sections/EquipoComunicaciones";
import Vehiculos from "./sections/Vehiculos";
import BarrasRemolque from "./sections/BarrasRemolque";
import GPUs from "./sections/GPUs";
import CarritoGolf from "./sections/CarritoGolf";
import Aeronaves from "./sections/Aeronaves";
import Firmas from "./sections/Firmas";
import Swal from "sweetalert2";
import { guardarEntregaTurnoRApi, actualizarEntregaTurnoRApi } from "@/stores/apiEntregaTurnoR";

type FirmaItem = {
    id: number;
    url: string;
    rol: "quien_entrega" | "jefe_rampa" | "quien_recibe";
};

type EntregaTurnoData = {
    id?: any;
    encabezado?: any;
    comunicaciones?: any;
    vehiculos?: any;
    barras_remolque?: any;
    gpus?: any;
    carrito_golf?: any;
    aeronaves?: any;
    firmas?: FirmaItem[];
};

type Props = {
    onSuccess?: () => void;
    initialData?: EntregaTurnoData;
    loading?: boolean;
};

const initialFormState = {
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
        gpu115: { limpia: "", horometro: "", cantidad: "", enchufe: "", llantas: "", obs: "" },
        hobart600: { limpia: "", horometro: "", cantidad: "", enchufe: "", llantas: "", obs: "" },
        foxtronics: { limpia: "", horometro: "", cantidad: "", enchufe: "", llantas: "", obs: "" },
    },
    carritoGolf: {
        "005": { limpieza: "", carga: "", llantas: "", luces: "", frenos: "", obs: "" },
    },
    aeronaves: {
        hangar1: "",
        hangar2: "",
        plataforma_h1: "",
        plataforma_h2: "",
    },
    firmas: {
        quienEntrega: "",
        jefeRampa: "",
        quienRecibe: "",
    },
};

export default function EntregaTurnoRForm({
    onSuccess,
    initialData,
    loading = false,
}: Props) {
    const [form, setForm] = useState(initialFormState);
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const totalSteps = 5;
    const isEdit = Boolean(initialData);
    const entregaId = initialData?.id;

    useEffect(() => {
        if (!initialData) return;

        const firmasMap = Object.fromEntries(
            (initialData.firmas ?? []).map((f) => [f.rol, f.url])
        );
        console.log('initialData: ', initialData.id);

        setForm({
            ...initialFormState,
            encabezado: initialData.encabezado ?? initialFormState.encabezado,
            comunicaciones: initialData.comunicaciones ?? initialFormState.comunicaciones,
            vehiculos: initialData.vehiculos ?? initialFormState.vehiculos,
            barrasRemolque: initialData.barras_remolque ?? initialFormState.barrasRemolque,
            gpus: initialData.gpus ?? initialFormState.gpus,
            carritoGolf: initialData.carrito_golf ?? initialFormState.carritoGolf,
            aeronaves: initialData.aeronaves ?? initialFormState.aeronaves,
            firmas: {
                quienEntrega: firmasMap.quien_entrega ?? "",
                jefeRampa: firmasMap.jefe_rampa ?? "",
                quienRecibe: firmasMap.quien_recibe ?? "",
            },
        });

        setStep(1);
    }, [initialData]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const confirm = await Swal.fire({
            title: isEdit ? "¿Actualizar entrega?" : "¿Guardar entrega?",
            icon: "question",
            showCancelButton: true,
            confirmButtonText: "Aceptar",
        });

        if (!confirm.isConfirmed) return;

        setSaving(true);

        try {
            Swal.fire({ title: "Procesando...", didOpen: () => Swal.showLoading() });

            if (isEdit) {
                await actualizarEntregaTurnoRApi(entregaId, form);
            } else {
                await guardarEntregaTurnoRApi(form);
            }

            Swal.fire({
                icon: "success",
                title: isEdit ? "Entrega actualizada" : "Entrega guardada",
            }).then(() => {
                setForm(initialFormState);
                setStep(1);
                onSuccess?.();
            });
        } catch (error: any) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: error?.message || "Error al guardar",
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="py-20 text-center text-sm">Cargando información...</div>;
    }
    const nextStep = () => {
        const resultado = validarStep(step, form);

        if (!resultado.ok) {
            Swal.fire({
                icon: "warning",
                title: resultado.message,
                html: `
                <ul style="text-align:left;">
                    ${resultado.faltantes
                        ?.map((f) => `<li>• ${f}</li>`)
                        .join("")}
                </ul>
            `,
                confirmButtonText: "Aceptar",
                confirmButtonColor: "#ea580c",
            });
            return;
        }

        if (step < totalSteps) setStep(step + 1);
    };
    return (
        <form className="mx-auto max-w-6xl space-y-6" onSubmit={handleSubmit}>
            <div className="flex items-center justify-between rounded-lg border px-4 py-2 text-sm font-bold">
                <span>Paso {step} de {totalSteps}</span>
                <div className="flex gap-2">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <div
                            key={i}
                            className={`h-2 w-6 rounded-full ${
                                step === i + 1 ? "bg-orange-600" : "bg-slate-300"
                            }`}
                        />
                    ))}
                </div>
            </div>

            {step === 1 && (
                <>
                    <Encabezado form={form} updateField={updateField} />
                    <EquipoComunicaciones form={form} updateField={updateField} />
                </>
            )}
            {step === 2 && <Vehiculos form={form} updateField={updateField} />}
            {step === 3 && (
                <>
                    <BarrasRemolque form={form} updateField={updateField} />
                    <GPUs form={form} updateField={updateField} />
                </>
            )}
            {step === 4 && <CarritoGolf form={form} updateField={updateField} />}
            {step === 5 && (
                <>
                    <Aeronaves form={form} updateField={updateField} />
                    <Firmas form={form} updateField={updateField} />
                </>
            )}

            <div className="flex justify-between pt-4">
                {step > 1 && (
                    <button type="button" onClick={() => setStep(step - 1)} className="border px-4 py-2 rounded">
                        Anterior
                    </button>
                )}
                {step < totalSteps && (
                    <button type="button" onClick={nextStep} className="bg-orange-600 px-6 py-2 text-white rounded">
                        Siguiente
                    </button>
                )}
                {step === totalSteps && (
                    <button type="submit" disabled={saving} className="bg-green-600 px-6 py-2 text-white rounded">
                        {saving ? (isEdit ? "Actualizando..." : "Guardando...") : isEdit ? "Actualizar Entrega" : "Guardar Entrega"}
                    </button>
                )}
            </div>
        </form>
    );
}
