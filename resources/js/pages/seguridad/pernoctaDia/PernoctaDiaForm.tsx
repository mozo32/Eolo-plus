import React, { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    FileText,
    LoaderCircle,
    MapPin,
    Plane,
    Plus,
    User,
} from "lucide-react";

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

const PernoctaDiaForm: React.FC<Props> = ({ onAdd }) => {
    const today = new Date().toLocaleDateString("en-CA");
    const { auth } = usePage<{ auth: { user: any } }>().props;

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

    const matriculaValida = useMemo(() => {
        const regexGeneral = /^[A-Z0-9]{1,3}-[A-Z0-9]{1,5}$/;
        const regexUSA = /^N[1-9][0-9A-Z]{0,4}$/;

        return (
            regexGeneral.test(form.matricula) ||
            regexUSA.test(form.matricula)
        );
    }, [form.matricula]);

    const statusMatricula = useMemo(() => {
        if (!form.matricula) {
            return {
                type: "empty",
                message: "",
            };
        }

        if (matriculaValida) {
            return {
                type: "success",
                message: "Matrícula válida",
            };
        }

        if (form.matricula.length <= 3) {
            return {
                type: "typing",
                message: "Continúa escribiendo la matrícula",
            };
        }

        return {
            type: "error",
            message: "Usa un formato como XA-ABC o N12345",
        };
    }, [form.matricula, matriculaValida]);

    const aplicarFormatoMatricula = (
        input: string,
        previousValue: string,
    ) => {
        let value = input.toUpperCase().replace(/\s/g, "");

        if (value.length < previousValue.length) {
            return value;
        }

        const prefijos = [
            "XA",
            "XB",
            "XC",
            "EC",
            "CC",
            "LV",
            "LQ",
            "HK",
            "HJ",
            "TG",
            "TI",
            "HC",
            "YV",
            "ZP",
            "OB",
        ];

        if (value.length === 2 && prefijos.includes(value)) {
            return `${value}-`;
        }

        if (value.length > 2 && !value.includes("-")) {
            const prefix = value.substring(0, 2);

            if (prefijos.includes(prefix)) {
                value = `${prefix}-${value.substring(2)}`;
            }
        }

        return value;
    };

    const buscarMatriculas = async (query: string) => {
        setLoadingMatricula(true);

        try {
            const response = await fetch(
                `/api/PernoctaDia/matriculas/buscar?q=${encodeURIComponent(query)}`,
            );

            if (!response.ok) {
                throw new Error("Error al consultar matrículas");
            }

            const data = await response.json();

            setSugerencias(Array.isArray(data) ? data : []);
        } catch {
            setSugerencias([]);
        } finally {
            setLoadingMatricula(false);
        }
    };

    const handleChange = (
        event: React.ChangeEvent<
            HTMLInputElement | HTMLTextAreaElement
        >,
    ) => {
        const { name, value } = event.target;

        if (name === "matricula") {
            const formattedValue = aplicarFormatoMatricula(
                value,
                form.matricula,
            );

            setForm((previous) => ({
                ...previous,
                matricula: formattedValue,
            }));

            setErrors((previous) => ({
                ...previous,
                matricula: "",
            }));

            if (formattedValue.length >= 2) {
                buscarMatriculas(formattedValue);
            } else {
                setSugerencias([]);
            }

            return;
        }

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));

        setErrors((previous) => ({
            ...previous,
            [name]: "",
        }));
    };

    const seleccionarUbicacion = (ubicacion: string) => {
        setForm((previous) => ({
            ...previous,
            ubicacion,
        }));

        setErrors((previous) => ({
            ...previous,
            ubicacion: "",
        }));
    };

    const seleccionarSugerencia = (matricula: string) => {
        setForm((previous) => ({
            ...previous,
            matricula: matricula.toUpperCase(),
        }));

        setErrors((previous) => ({
            ...previous,
            matricula: "",
        }));

        setSugerencias([]);
    };

    const handleBlur = () => {
        setTimeout(() => {
            setSugerencias([]);
        }, 200);
    };

    const handleAdd = () => {
        const validationErrors: Record<string, string> = {};

        if (!form.fecha) {
            validationErrors.fecha = "Selecciona la fecha";
        }

        if (!form.matricula.trim()) {
            validationErrors.matricula = "Ingresa la matrícula";
        } else if (!matriculaValida) {
            validationErrors.matricula =
                "La matrícula no tiene un formato válido";
        }

        if (!form.ubicacion) {
            validationErrors.ubicacion = "Selecciona la ubicación";
        }

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        onAdd({
            ...form,
            matricula: form.matricula.trim().toUpperCase(),
            observaciones: form.observaciones.trim(),
        });

        setForm((previous) => ({
            ...previous,
            matricula: "",
            ubicacion: "",
            observaciones: "",
        }));

        setErrors({});
        setSugerencias([]);
    };

    return (
        <div className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-100">
                        <Plane size={21} />
                    </div>

                    <div>
                        <h4 className="text-sm font-black uppercase tracking-tight text-slate-800">
                            Captura de aeronave
                        </h4>

                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
                            Agrega una aeronave a la pernocta
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
                        <User size={14} className="text-slate-400" />

                        <div>
                            <p className="text-[7px] font-black uppercase tracking-widest text-slate-400">
                                Responsable
                            </p>

                            <p className="max-w-[180px] truncate text-[10px] font-bold text-slate-700">
                                {form.nombre || "Sin responsable"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2">
                        <CalendarDays
                            size={14}
                            className="text-indigo-500"
                        />

                        <div>
                            <p className="text-[7px] font-black uppercase tracking-widest text-indigo-400">
                                Fecha
                            </p>

                            <input
                                type="date"
                                name="fecha"
                                value={form.fecha}
                                onChange={handleChange}
                                className="bg-transparent text-[10px] font-black text-indigo-700 outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12">
                <div className="space-y-5 border-b border-slate-100 p-5 lg:col-span-7 lg:border-b-0 lg:border-r">
                    <div className="relative">
                        <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                            Matrícula de la aeronave
                            <span className="ml-1 text-rose-500">*</span>
                        </label>

                        <div
                            className={`relative overflow-hidden rounded-xl border transition-all ${
                                errors.matricula
                                    ? "border-rose-400 bg-rose-50"
                                    : "border-slate-200 bg-slate-50 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-50"
                            }`}
                        >
                            <div className="absolute bottom-0 left-0 top-0 flex w-12 items-center justify-center border-r border-slate-200 text-slate-400">
                                <Plane size={18} />
                            </div>

                            <input
                                type="text"
                                name="matricula"
                                value={form.matricula}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                placeholder="XA-ABC"
                                autoComplete="off"
                                className="h-14 w-full bg-transparent pl-16 pr-12 text-lg font-black uppercase tracking-[0.12em] text-slate-800 outline-none placeholder:text-slate-300"
                            />

                            {loadingMatricula && (
                                <LoaderCircle
                                    size={18}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-indigo-500"
                                />
                            )}
                        </div>

                        {errors.matricula ? (
                            <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-rose-500">
                                <AlertCircle size={12} />
                                {errors.matricula}
                            </div>
                        ) : (
                            form.matricula && (
                                <div
                                    className={`mt-2 flex items-center gap-1.5 text-[9px] font-bold ${
                                        statusMatricula.type === "success"
                                            ? "text-emerald-600"
                                            : statusMatricula.type === "error"
                                              ? "text-rose-500"
                                              : "text-slate-400"
                                    }`}
                                >
                                    {statusMatricula.type === "success" ? (
                                        <CheckCircle2 size={12} />
                                    ) : (
                                        <AlertCircle size={12} />
                                    )}

                                    {statusMatricula.message}
                                </div>
                            )
                        )}

                        {sugerencias.length > 0 && (
                            <div className="absolute left-0 right-0 top-[86px] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
                                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                                        Resultados encontrados
                                    </p>
                                </div>

                                <div className="max-h-52 overflow-y-auto">
                                    {sugerencias.map((sugerencia) => (
                                        <button
                                            key={sugerencia}
                                            type="button"
                                            onMouseDown={() =>
                                                seleccionarSugerencia(
                                                    sugerencia,
                                                )
                                            }
                                            className="flex w-full items-center justify-between border-b border-slate-50 px-4 py-3 text-left transition-colors last:border-0 hover:bg-indigo-50"
                                        >
                                            <span className="text-xs font-black uppercase tracking-wide text-slate-700">
                                                {sugerencia}
                                            </span>

                                            <span className="text-[8px] font-black uppercase text-indigo-500">
                                                Usar matrícula
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="mb-2 block text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                            Lugar de pernocta
                            <span className="ml-1 text-rose-500">*</span>
                        </label>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {[
                                {
                                    value: "H1",
                                    label: "Hangar 1",
                                    description:
                                        "Ubicación asignada en hangar uno",
                                },
                                {
                                    value: "H2",
                                    label: "Hangar 2",
                                    description:
                                        "Ubicación asignada en hangar dos",
                                },
                            ].map((hangar) => {
                                const active =
                                    form.ubicacion === hangar.value;

                                return (
                                    <button
                                        key={hangar.value}
                                        type="button"
                                        onClick={() =>
                                            seleccionarUbicacion(
                                                hangar.value,
                                            )
                                        }
                                        className={`relative flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                                            active
                                                ? "border-indigo-500 bg-indigo-50 shadow-sm ring-2 ring-indigo-100"
                                                : errors.ubicacion
                                                  ? "border-rose-300 bg-rose-50"
                                                  : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"
                                        }`}
                                    >
                                        <div
                                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                                                active
                                                    ? "bg-indigo-600 text-white"
                                                    : "bg-slate-100 text-slate-400"
                                            }`}
                                        >
                                            <MapPin size={18} />
                                        </div>

                                        <div className="min-w-0">
                                            <p
                                                className={`text-xs font-black uppercase ${
                                                    active
                                                        ? "text-indigo-700"
                                                        : "text-slate-700"
                                                }`}
                                            >
                                                {hangar.label}
                                            </p>

                                            <p className="mt-0.5 truncate text-[8px] font-bold text-slate-400">
                                                {hangar.description}
                                            </p>
                                        </div>

                                        <div
                                            className={`absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full border ${
                                                active
                                                    ? "border-indigo-600 bg-indigo-600 text-white"
                                                    : "border-slate-300 bg-white"
                                            }`}
                                        >
                                            {active && <CheckCircle2 size={11} />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {errors.ubicacion && (
                            <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-rose-500">
                                <AlertCircle size={12} />
                                {errors.ubicacion}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col p-5 lg:col-span-5">
                    <div className="flex-1">
                        <div className="mb-2 flex items-center justify-between">
                            <label className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                                Observaciones
                            </label>

                            <span className="text-[8px] font-bold text-slate-400">
                                {form.observaciones.length}/500
                            </span>
                        </div>

                        <div className="relative">
                            <FileText
                                size={17}
                                className="absolute left-3 top-3 text-slate-400"
                            />

                            <textarea
                                name="observaciones"
                                value={form.observaciones}
                                onChange={handleChange}
                                rows={6}
                                maxLength={500}
                                placeholder="Agrega información relevante sobre la estancia, salida, combustible o mantenimiento..."
                                className="min-h-[155px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-3 text-xs font-medium leading-relaxed text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50"
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleAdd}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-[0.98]"
                    >
                        <Plus size={17} />
                        Agregar aeronave
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PernoctaDiaForm;
