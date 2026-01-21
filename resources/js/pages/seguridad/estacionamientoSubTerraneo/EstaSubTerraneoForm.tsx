import Swal from "sweetalert2";
import { useState } from "react";
import { usePage } from "@inertiajs/react";
import { guardarEstaSubTerraneo } from "@/stores/apiEstacionamientoSubterraneo";

type FormState = {
    fecha_ingreso: string;
    vehiculo: string;
    color: string;
    placas: string;
    matricula: string;
    responsable: string;
    oficial: string;
};

type Props = {
    onClose: () => void;
};

type PageProps = {
    auth: {
        user: {
            name: string;
        } | null;
    };
};

export default function EstaSubTerraneoForm({ onClose }: Props) {
    const { auth } = usePage<PageProps>().props;

    const getNowForDateTimeLocal = () => {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        return new Date(now.getTime() - offset * 60000)
            .toISOString()
            .slice(0, 16);
    };

    const [form, setForm] = useState<FormState>({
        fecha_ingreso: getNowForDateTimeLocal(),
        vehiculo: "",
        color: "",
        placas: "",
        matricula: "",
        responsable: "",
        oficial: auth.user?.name ?? "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;

        setForm(prev => ({
            ...prev,
            [name]: value.toUpperCase(),
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            await guardarEstaSubTerraneo(form);
            onClose();
        } catch (error: any) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: error?.message || "Error al guardar",
            });
        }
    };

    const inputClass =
        "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm " +
        "focus:border-primary focus:ring-1 focus:ring-primary " +
        "dark:bg-gray-900 dark:border-gray-700 dark:text-white";

    return (
        <form onSubmit={handleSubmit} className="space-y-8">

            {/* DATOS DEL VEHÍCULO */}
            <section>
                <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Datos del vehículo
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400">
                            Vehículo
                        </label>
                        <input
                            name="vehiculo"
                            value={form.vehiculo}
                            onChange={handleChange}
                            placeholder="Ej. AVEO"
                            className={`${inputClass} uppercase`}
                        />
                    </div>

                    <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400">
                            Color
                        </label>
                        <input
                            name="color"
                            value={form.color}
                            onChange={handleChange}
                            placeholder="Ej. BLANCO"
                            className={`${inputClass} uppercase`}
                        />
                    </div>

                    <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400">
                            Placas
                        </label>
                        <input
                            name="placas"
                            value={form.placas}
                            onChange={handleChange}
                            placeholder="ABC-123"
                            className={`${inputClass} uppercase`}
                        />
                    </div>
                </div>
            </section>

            {/* RESPONSABLE */}
            <section>
                <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Responsable
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400">
                            Nombre
                        </label>
                        <input
                            name="responsable"
                            value={form.responsable}
                            onChange={handleChange}
                            placeholder="Nombre completo"
                            className={`${inputClass} uppercase`}
                        />
                    </div>

                    <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400">
                            Matrícula
                        </label>
                        <input
                            name="matricula"
                            value={form.matricula}
                            onChange={handleChange}
                            placeholder="MATRÍCULA"
                            className={`${inputClass} uppercase`}
                        />
                    </div>
                </div>
            </section>

            {/* CONTROL DE ACCESO */}
            <section>
                <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Control de acceso
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400">
                            Fecha y hora de ingreso
                        </label>
                        <input
                            type="datetime-local"
                            name="fecha_ingreso"
                            value={form.fecha_ingreso}
                            onChange={handleChange}
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className="text-xs text-gray-600 dark:text-gray-400">
                            Oficial
                        </label>
                        <input
                            name="oficial"
                            value={form.oficial}
                            onChange={handleChange}
                            className={`${inputClass} uppercase`}
                        />
                    </div>
                </div>
            </section>

            {/* BOTONES */}
            <div className="flex justify-end gap-3 border-t pt-4 dark:border-gray-700">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                    Cancelar
                </button>

                <button
                    type="submit"
                    className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                >
                    Guardar
                </button>
            </div>
        </form>
    );
}
