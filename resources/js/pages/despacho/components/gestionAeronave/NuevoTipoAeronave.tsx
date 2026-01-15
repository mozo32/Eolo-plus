import { FormEvent, useEffect, useState } from 'react';
import Swal from "sweetalert2";
import { validarGestionAeronave } from './validacionNuevoTipo';
export interface NuevoTipoAeronaveItem {
    nombre: string;
}

interface NuevoTipoAeronaveProps {
    onClose?: () => void;
}
export default function NuevoTipoAeronave({ onClose }: NuevoTipoAeronaveProps) {
    const [form, setForm] = useState<NuevoTipoAeronaveItem>({
        nombre: '',
    });
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };
    const [isSubmitting, setIsSubmitting] = useState(false);
    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const faltantes = validarGestionAeronave(form);
        if (faltantes.length > 0) {
            Swal.fire({
                icon: "warning",
                title: "Faltan datos por completar",
                html: `
                    <div style="text-align:left;font-size:13px;">
                        <p>Revise los siguientes campos:</p>
                        <ul style="margin-top:8px;padding-left:18px;">
                            ${faltantes.map(f => `<li>${f}</li>`).join("")}
                        </ul>
                    </div>
                `,
                confirmButtonText: "Entendido"
            });
            return;
        }
        try {
            setIsSubmitting(true);

            const resp = await fetch("/api/nuevo-tipo-aeronaves", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify({
                    nombre: form.nombre,
                }),
            });

            if (!resp.ok) {
                let msg = "Ocurrió un error al guardar la aeronave.";
                try {
                    const errorData = await resp.json();
                    if (errorData?.message) {
                        msg = errorData.message;
                    }
                } catch (_) { }

                Swal.fire({
                    icon: "error",
                    title: "Error al guardar",
                    text: msg,
                    confirmButtonText: "Cerrar",
                });
                return;
            }

            const data = await resp.json();
            console.log("TIPO AERONAVE GUARDADA:", data);

            Swal.fire({
                icon: "success",
                title: "Aeronave registrada",
                text: "Los datos se guardaron correctamente.",
                confirmButtonText: "Aceptar"
            });

            if (onClose) onClose();
        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: "error",
                title: "Error de red",
                text: "No se pudo comunicar con el servidor.",
                confirmButtonText: "Cerrar",
            });
        } finally {
            setIsSubmitting(false);
        }

    };
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <section className="rounded-xl border border-gray-200 bg-slate-50/70 p-4 shadow-sm dark:border-gray-700 dark:bg-slate-900/40">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            Registro de nuevo tipo de aeronave
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Registre el nombre
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="grid gap-1">
                        <label
                            htmlFor="nombre"
                            className="text-sm font-medium text-gray-800 dark:text-gray-100"
                        >
                            Nombre
                        </label>
                        <input
                            id="nombre"
                            name="nombre"
                            type="text"
                            value={form.nombre}
                            onChange={handleChange}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm
                                outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                                dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            placeholder="Ej. XA-ABC"
                        />
                    </div>
                </div>

                <div className="sticky bottom-0 mt-4 flex justify-end gap-3 border-t border-dashed border-gray-300 pt-4 dark:border-gray-700">
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center rounded-lg bg-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-800 shadow-sm
                            transition hover:bg-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-1
                            dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                        >
                            Cerrar
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm
                            transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:opacity-60"
                    >
                        {isSubmitting ? "Guardando..." : "Guardar registro"}
                    </button>
                </div>
            </section>
        </form>
    )
}
