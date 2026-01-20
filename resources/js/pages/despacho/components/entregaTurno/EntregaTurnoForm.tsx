import React, { FormEvent, useMemo, useState, useEffect } from "react";
import Swal from "sweetalert2";
import { validarEntregaTurno } from "./validacionesEntregaTurno";
import ChecklistComunicacion, {
    ChecklistComunicacionState,
    EQUIPOS_COMUNICACION,
} from "./ChecklistComunicacion";
import { usePage } from "@inertiajs/react";
import EquipoOficina, {
    EquipoOficinaState,
    EQUIPOS_OFICINA_DEFAULT,
} from "./EquipoOficina";

import Copiadoras, { CopiadorasState } from "./Copiadoras";

import FondoDocumentacion, {
    FondoDocumentacionState,
    FONDO_DOC_DEFAULT,
} from "./FondoDocumentacion";
import { guardarEntregarTurnoApi, actualizarEntregarTurnoApi } from "@/stores/apiEntregarTurno";
import CajaFuerte from "./CajaFuerte";

interface SalidaFormData {
    fecha: string;
    nombre: string;
    nombreQuienEntrega: string;
    nombreJefeTurnoDespacho: string;

    checklistComunicacion: ChecklistComunicacionState;
    equipoOficina: EquipoOficinaState;
    copiadoras: CopiadorasState;
    fondoDocumentacion: FondoDocumentacionState;
    estadoCajaFuerte: string;
}

interface GestionTurnoFormProps {
    id?: number;
    onClose?: () => void;
    onSaved?: () => void;
    initialData?: Partial<SalidaFormData>;
    isEdit?: boolean;
}

type Step = 1 | 2 | 3 | 4 | 5;
type Role = {
    slug: string;
    nombre: string;
};
export type AuthUser = {
    id: number;
    name: string;
    email: string;
    isAdmin: boolean;
    roles: Role[];
    departamentos: {
        id: number;
        nombre: string;
        subdepartamentos: {
            id: number;
            nombre: string;
            route: string;
        }[];
    }[];
};
export default function EntregaTurnoForm({ id, onClose, onSaved, initialData, isEdit }: GestionTurnoFormProps) {
    const today = new Date().toISOString().slice(0, 10);

    const [step, setStep] = useState<Step>(1);
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;
    const [form, setForm] = useState<SalidaFormData>(() => ({
        fecha: today,
        nombre: "",
        nombreQuienEntrega: "",
        nombreJefeTurnoDespacho: "",
        checklistComunicacion: { items: {}, fallas: "" },
        equipoOficina: EQUIPOS_OFICINA_DEFAULT,
        copiadoras: { funciona: "", toner: "", paquetes: 0, fallas: "" },
        fondoDocumentacion: FONDO_DOC_DEFAULT,
        estadoCajaFuerte: "",
        ...initialData,
    }));

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    // Feedback visual
    const comunicacionIncompleta = !EQUIPOS_COMUNICACION.every(({ equipo }) => {
        const item = form.checklistComunicacion.items[equipo];
        return item && (item.cargado === "si" || item.cargado === "no");
    });

    const copiadorasIncompletas =
        form.copiadoras.funciona === "" || form.copiadoras.toner === "";

    const progressLabel = useMemo(() => {
        const map: Record<Step, string> = {
            1: "Comunicación",
            2: "Oficina",
            3: "Copiadoras",
            4: "Fondo/Caja",
            5: "Responsables",
        };
        return map[step];
    }, [step]);
    const user = auth?.user;
    useEffect(() => {
        if (!user) return;

        setForm(prev => ({
            ...prev,
            nombre: user.name,
        }));
    }, [user]);
    // Validación por paso (para avanzar)
    const canGoNext = () => {
        const faltantes = validarEntregaTurno({
            step,
            nombre: form.nombre,
            nombreQuienEntrega: form.nombreQuienEntrega,
            nombreJefeTurnoDespacho: form.nombreJefeTurnoDespacho,
            checklistComunicacion: form.checklistComunicacion,
            copiadoras: form.copiadoras,
            fondoDocumentacion: form.fondoDocumentacion,
            cajaFuerte: form.estadoCajaFuerte,
        });

        if (faltantes.length > 0) {
            Swal.fire({
                icon: "warning",
                title: "Faltan datos",
                html: `
                    <div style="text-align:left;font-size:13px;">
                        <ul style="padding-left:18px;">
                            ${faltantes.map(f => `<li>${f}</li>`).join("")}
                        </ul>
                    </div>
                `,
                confirmButtonText: "Entendido",
            });
            return false;
        }

        return true;
    };

    const nextStep = () => {
        if (!canGoNext()) return;
        setStep((s) => (s < 5 ? ((s + 1) as Step) : s));
    };

    const prevStep = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        const faltantes = validarEntregaTurno({
            step: 5,
            nombre: form.nombre,
            nombreQuienEntrega: form.nombreQuienEntrega,
            nombreJefeTurnoDespacho: form.nombreJefeTurnoDespacho,
            checklistComunicacion: form.checklistComunicacion,
            copiadoras: form.copiadoras,
            fondoDocumentacion: form.fondoDocumentacion,
            cajaFuerte: form.estadoCajaFuerte,
        });

        if (faltantes.length > 0) {
            Swal.fire({
                icon: "warning",
                title: "Faltan datos por completar",
                html: `
            <div style="text-align:left;font-size:13px;">
                <ul style="padding-left:18px;">
                    ${faltantes.map(f => `<li>${f}</li>`).join("")}
                </ul>
            </div>
        `,
            });
            return;
        }

        if (faltantes.length > 0) {
            Swal.fire({
                icon: "warning",
                title: "Faltan datos por completar",
                html: `
                    <div style="text-align:left;font-size:13px;">
                        <p>Antes de guardar, revise los siguientes puntos:</p>
                        <ul style="margin-top:8px;padding-left:18px;">
                        ${faltantes.map((f) => `<li>${f}</li>`).join("")}
                        </ul>
                    </div>
                `,
                confirmButtonText: "Entendido",
            });
            return;
        }
        if (isEdit) {
            await actualizarEntregarTurnoApi(id!, form);
        } else {
            await guardarEntregarTurnoApi(form);
        }

        await Swal.fire({
            icon: "success",
            title: isEdit ? "Entrega actualizada" : "Entrega guardada",
            text: "La información se registró correctamente.",
        });
        onSaved?.();
        onClose?.();
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Header Wizard */}
            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700 dark:bg-slate-900/40">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-base font-semibold">Entrega de turno</h2>
                        <p className="text-xs text-gray-500">
                            Paso {step} / 5 · {progressLabel}
                        </p>
                    </div>
                    <span className="rounded-full bg-gray-200 px-3 py-1 text-xs">
                        👤 {form.nombre} · 📅 {form.fecha}
                    </span>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                        className="h-full bg-gray-900 dark:bg-gray-100"
                        style={{ width: `${(step / 5) * 100}%` }}
                    />
                </div>
            </div>

            {/* STEP 1: Comunicación */}
            {step === 1 && (
                <section className="rounded-xl border border-gray-200 bg-slate-50/70 p-4 shadow-sm dark:border-gray-700 dark:bg-slate-900/40">
                    <ChecklistComunicacion
                        value={form.checklistComunicacion}
                        onChange={(next) => setForm((prev) => ({ ...prev, checklistComunicacion: next }))}
                    />

                    {comunicacionIncompleta && (
                        <p className="mt-2 rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                            Recuerde seleccionar <span className="font-semibold">“Cargado: Sí o No”</span> para todos los equipos de comunicación.
                        </p>
                    )}
                </section>
            )}

            {/* STEP 2: Oficina */}
            {step === 2 && (
                <section className="rounded-xl border border-gray-200 bg-slate-50/70 p-4 shadow-sm dark:border-gray-700 dark:bg-slate-900/40">
                    <EquipoOficina
                        value={form.equipoOficina}
                        onChange={(next) => setForm((prev) => ({ ...prev, equipoOficina: next }))}
                    />
                </section>
            )}

            {/* STEP 3: Copiadoras */}
            {step === 3 && (
                <section className="rounded-xl border border-gray-200 bg-slate-50/70 p-4 shadow-sm dark:border-gray-700 dark:bg-slate-900/40">
                    <Copiadoras
                        value={form.copiadoras}
                        onChange={(next) => setForm((prev) => ({ ...prev, copiadoras: next }))}
                    />

                    {copiadorasIncompletas && (
                        <p className="mt-2 rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
                            Indique si la copiadora funciona y el estado del tóner.
                        </p>
                    )}
                </section>
            )}

            {/* STEP 4: Fondo + Caja */}
            {step === 4 && (
                <section className="space-y-4">
                    <div className="rounded-xl border border-gray-200 bg-slate-50/70 p-4 shadow-sm dark:border-gray-700 dark:bg-slate-900/40">
                        <FondoDocumentacion
                            value={form.fondoDocumentacion}
                            onChange={(next) => setForm((prev) => ({ ...prev, fondoDocumentacion: next }))}
                        />
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-slate-50/70 p-4 shadow-sm dark:border-gray-700 dark:bg-slate-900/40">
                        <CajaFuerte
                            value={form.estadoCajaFuerte}
                            onChange={(value) => setForm((prev) => ({ ...prev, estadoCajaFuerte: value }))}
                        />
                    </div>
                </section>
            )}

            {/* STEP 5: Responsables */}
            {step === 5 && (
                <section className="rounded-xl border border-gray-200 bg-slate-50/70 p-4 shadow-sm dark:border-gray-700 dark:bg-slate-900/40">
                    <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">
                        Responsables de la entrega
                    </h2>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div className="grid gap-1">
                            <label htmlFor="nombreQuienEntrega" className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                Nombre de quien entrega
                            </label>
                            <input
                                id="nombreQuienEntrega"
                                name="nombreQuienEntrega"
                                type="text"
                                value={form.nombreQuienEntrega}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        nombreQuienEntrega: e.target.value.toUpperCase(),
                                    }))
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm
                                outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                                dark:border-gray-700 dark:bg-gray-900 dark:text-white uppercase"
                                placeholder="Nombre completo"
                            />
                        </div>

                        <div className="grid gap-1">
                            <label htmlFor="nombreJefeTurnoDespacho" className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                Jefe de despacho
                            </label>
                            <input
                                id="nombreJefeTurnoDespacho"
                                name="nombreJefeTurnoDespacho"
                                type="text"
                                value={form.nombreJefeTurnoDespacho}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        nombreJefeTurnoDespacho: e.target.value.toUpperCase(),
                                    }))
                                }
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm
                                outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                                dark:border-gray-700 dark:bg-gray-900 dark:text-white uppercase"
                                placeholder="Nombre completo"
                            />
                        </div>
                    </div>
                </section>
            )}

            {/* Navegación */}
            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-white/80 py-3 backdrop-blur dark:border-gray-700 dark:bg-slate-950/40">
                <div className="flex gap-2">
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center rounded-lg bg-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-800 shadow-sm
              transition hover:bg-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                            Cerrar
                        </button>
                    )}

                    {step > 1 && (
                        <button
                            type="button"
                            onClick={prevStep}
                            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold
              hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                        >
                            ← Anterior
                        </button>
                    )}
                </div>

                <div className="flex gap-2">
                    {step < 5 && (
                        <button
                            type="button"
                            onClick={nextStep}
                            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white"
                        >
                            Siguiente →
                        </button>
                    )}

                    {step === 5 && (
                        <button
                            type="submit"
                            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white"
                        >
                            Guardar entrega de turno
                        </button>
                    )}
                </div>
            </div>
        </form>
    );
}
