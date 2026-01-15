import { FormEvent, useEffect, useState } from 'react';
import { validarGestionAeronave } from "./validacionesGestionAeronave";
import Swal from "sweetalert2";
import { fetchTiposAeronaveApi, TipoAeronaveApi } from '@/stores/apiAeronave';

export interface GestionAeronaveItem {
    matricula: string;
    tipo: string;
    tipoAeronave: number;
}

interface GestionAeronaveFormProps {
    onClose?: () => void;
}

export default function GestionAeronaveForm({ onClose }: GestionAeronaveFormProps) {
    const [form, setForm] = useState<GestionAeronaveItem>({
        matricula: '',
        tipo: '',
        tipoAeronave: 0,
    });

    const [tiposAeronave, setTiposAeronave] = useState<TipoAeronaveApi[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

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

            const resp = await fetch("/api/aeronaves", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                body: JSON.stringify({
                    matricula: form.matricula,
                    tipo: form.tipo,
                    tipoAeronave: form.tipoAeronave,
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
            console.log("AERONAVE GUARDADA:", data);

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

    useEffect(() => {
        const cargarTipos = async () => {
            try {
                const data = await fetchTiposAeronaveApi();
                setTiposAeronave(data);
            } catch (error) {
                console.error("Error al cargar tipos de aeronave:", error);
            }
        };

        cargarTipos();
    }, []);

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <section className="rounded-xl border border-gray-200 bg-slate-50/70 p-4 shadow-sm dark:border-gray-700 dark:bg-slate-900/40">
                <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            Registro de aeronave
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Registre la matrícula y el tipo de aeronave
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="grid gap-1">
                        <label
                            htmlFor="matricula"
                            className="text-sm font-medium text-gray-800 dark:text-gray-100"
                        >
                            Matrícula
                        </label>
                        <input
                            id="matricula"
                            name="matricula"
                            type="text"
                            value={form.matricula}
                            onChange={handleChange}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm
                                outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                                dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            placeholder="Ej. XA-ABC"
                        />
                    </div>

                    <div className="grid gap-1">
                        <label
                            htmlFor="tipo"
                            className="text-sm font-medium text-gray-800 dark:text-gray-100"
                        >
                            Tipo
                        </label>
                        <input
                            id="tipo"
                            name="tipo"
                            type="text"
                            value={form.tipo}
                            onChange={handleChange}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm
                                outline-none ring-0 transition hover:border-gray-400 focus:border-primary focus:ring-1 focus:ring-primary
                                dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                            placeholder="Ej. Learjet 45, Bell 407..."
                        />
                    </div>

                    <div className="grid gap-1">
                        <label
                            htmlFor="tipoAeronave"
                            className="text-xs font-medium text-gray-700 dark:text-gray-200"
                        >
                            Tipo de aeronave
                        </label>
                        <select
                            id="tipoAeronave"
                            name="tipoAeronave"
                            value={form.tipoAeronave || 0}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    tipoAeronave: Number(e.target.value) || 0,
                                }))
                            }
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2
                                text-sm text-gray-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary
                                dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                        >
                            <option value={0}>Seleccione una opción</option>
                            {tiposAeronave.map((tipo) => (
                                <option key={tipo.id} value={tipo.id}>
                                    {tipo.nombre}
                                </option>
                            ))}
                        </select>
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
    );
}
