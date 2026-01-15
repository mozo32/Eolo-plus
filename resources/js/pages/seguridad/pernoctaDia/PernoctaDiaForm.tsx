import React, { useState } from "react";
import { validatePernoctaDia } from "./validation";
import { usePage } from "@inertiajs/react";

export type PernoctaDiaItem = {
    fecha: string;
    hora: string;
    matricula: string;
    ubicacion: string;
    observaciones: string;
    nombre: string;
};

interface Props {
    onAdd: (item: PernoctaDiaItem) => void;
}
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
const PernoctaDiaForm: React.FC<Props> = ({ onAdd }) => {
    const today = new Date().toISOString().split("T")[0];
    const { auth } = usePage<{ auth: { user: AuthUser | null } }>().props;

    const [form, setForm] = useState<PernoctaDiaItem>({
        fecha: today,
        hora: "",
        matricula: "",
        ubicacion: "",
        observaciones: "",
        nombre: auth?.user?.name ?? "",
    });
    const [sugerencias, setSugerencias] = useState<string[]>([]);
    const [loadingMatricula, setLoadingMatricula] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });

        if (errors[name]) {
            setErrors({ ...errors, [name]: "" });
        }

        if (name === "matricula") {
            buscarMatriculas(value);
        }
    };
    const buscarMatriculas = async (value: string) => {
        if (!value) {
            setSugerencias([]);
            return;
        }

        setLoadingMatricula(true);

        try {
            const res = await fetch(`/api/PernoctaDia/matriculas/buscar?q=${value}`);
            const data = await res.json();
            setSugerencias(data);
        } catch {
            setSugerencias([]);
        } finally {
            setLoadingMatricula(false);
        }
    };

    const handleSubmit = () => {
        const validationErrors = validatePernoctaDia(form);
        if (Object.keys(validationErrors).length) {
            setErrors(validationErrors);
            return;
        }

        onAdd({
            ...form,
            fecha: today,
            hora: new Date().toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
            }),
        });

        setForm({
            fecha: today,
            hora: "",
            matricula: "",
            ubicacion: "",
            observaciones: "",
            nombre: auth?.user?.name ?? "",
        });
        setErrors({});
    };

    const inputClass = (hasError?: boolean) =>
        [
            "w-full rounded-lg border px-3 py-2 text-sm transition outline-none",
            "focus:ring-2 focus:ring-primary/40",
            hasError
                ? "border-red-500 focus:ring-red-300"
                : "border-gray-300 dark:border-gray-700",
            "bg-white dark:bg-gray-900",
        ].join(" ");

    const radioCard = (active: boolean) =>
        [
            "flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 text-sm transition",
            active
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800",
        ].join(" ");

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-900">
            {/* Header */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        Registrar pernocta de día
                    </h3>
                    <p className="text-xs text-gray-500">
                        Captura la información requerida
                    </p>
                </div>

                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    Fecha: {form.fecha}
                </span>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Matrícula */}
                <div className="relative space-y-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        Matrícula *
                    </label>

                    <input
                        name="matricula"
                        value={form.matricula}
                        onChange={handleChange}
                        placeholder="Ej. XA-ABC"
                        autoComplete="off"
                        className={inputClass(!!errors.matricula)}
                    />

                    {loadingMatricula && (
                        <p className="text-xs text-gray-400">Buscando…</p>
                    )}

                    {sugerencias.length > 0 && (
                        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-white shadow-md dark:border-gray-700 dark:bg-gray-900">
                            {sugerencias.map((m) => (
                                <li
                                    key={m}
                                    onClick={() => {
                                        setForm({ ...form, matricula: m });
                                        setSugerencias([]);
                                    }}
                                    className="cursor-pointer px-3 py-2 text-sm hover:bg-primary/10"
                                >
                                    {m}
                                </li>
                            ))}
                        </ul>
                    )}

                    {errors.matricula && (
                        <p className="text-xs text-red-600">{errors.matricula}</p>
                    )}
                </div>

                {/* Nombre */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        Nombre *
                    </label>
                    <input
                        name="nombre"
                        value={form.nombre}
                        onChange={handleChange}
                        placeholder="Responsable"
                        disabled
                        className="w-full rounded-lg border px-3 py-2 text-sm
                                    bg-gray-100 text-gray-700 cursor-not-allowed
                                    dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700"
                    />
                    {errors.nombre && (
                        <p className="text-xs text-red-600">{errors.nombre}</p>
                    )}
                </div>

                {/* Ubicación */}
                <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        Ubicación *
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                        <label className={radioCard(form.ubicacion === "H1")}>
                            <input
                                type="radio"
                                name="ubicacion"
                                value="H1"
                                checked={form.ubicacion === "H1"}
                                onChange={handleChange}
                                className="h-4 w-4 text-primary"
                            />
                            <span>Hangar 1</span>
                        </label>

                        <label className={radioCard(form.ubicacion === "H2")}>
                            <input
                                type="radio"
                                name="ubicacion"
                                value="H2"
                                checked={form.ubicacion === "H2"}
                                onChange={handleChange}
                                className="h-4 w-4 text-primary"
                            />
                            <span>Hangar 2</span>
                        </label>
                    </div>

                    {errors.ubicacion && (
                        <p className="text-xs text-red-600">{errors.ubicacion}</p>
                    )}
                </div>

                {/* Observaciones */}
                <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        Observaciones
                    </label>
                    <textarea
                        name="observaciones"
                        value={form.observaciones}
                        onChange={handleChange}
                        placeholder="Notas adicionales (opcional)"
                        rows={3}
                        className={inputClass()}
                    />
                </div>
            </div>

            {/* Acciones */}
            <div className="mt-8 flex justify-end">
                <button
                    type="button"
                    onClick={handleSubmit}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
                >
                    Agregar
                </button>
            </div>
        </div>
    );
};

export default PernoctaDiaForm;
