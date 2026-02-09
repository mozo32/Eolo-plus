import { useState } from "react";

const EQUIPOS = [
    {
        id: "revision_base_operaciones",
        label: "Revisión de Base de Operaciones",
        sublabel: "Completar operaciones y revisar errores",
    },
    {
        id: "envia_informe_diario",
        label: "Informe Diario",
        sublabel: "Enviar antes de la 1:00 am",
    },
    {
        id: "envia_resumen_semanal",
        label: "Resumen Semanal",
        sublabel: "Solo Jueves, antes de las 9:00 pm",
    },
];

type Registro = {
    matricula: string;
    descripcion: string;
    fecha: string;
    hora: string;
    notas: string;
};

type Props = {
    form: any;
    updateField: (path: string, value: any) => void;
};

export default function HotTrasComiCoor({ form, updateField }: Props) {
    const [localForm, setLocalForm] = useState<Registro>({
        matricula: "",
        descripcion: "",
        fecha: "",
        hora: "",
        notas: "",
    });

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setLocalForm((prev) => ({ ...prev, [name]: value }));
    };

    const agregarRegistro = () => {
        if (!localForm.matricula || !localForm.descripcion || !localForm.fecha || !localForm.hora) {
            alert("Complete los campos obligatorios");
            return;
        }

        updateField("HotTrasComiCoor", [
            ...(form.HotTrasComiCoor || []),
            localForm,
        ]);

        setLocalForm({
            matricula: "",
            descripcion: "",
            fecha: "",
            hora: "",
            notas: "",
        });
    };

    // CLASE MEJORADA PARA VISIBILIDAD EN TABLETS
    const inputClass =
        "w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-3 text-sm " +
        "text-slate-700 shadow-sm transition-all outline-none " +
        "placeholder:text-slate-400 " +
        "focus:border-sky-600 focus:ring-4 focus:ring-sky-600/10 focus:bg-white";

    const labelClass =
        "mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700";

    return (
        <div className="mx-auto max-w-6xl space-y-8 p-4">
            {/* SECCIÓN PRINCIPAL */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
                <div className="border-b border-slate-100 bg-slate-50/50 p-6">
                    <h3 className="text-lg font-bold text-slate-800">
                        Hoteles / Traslados / <span className="text-sky-600">Coordinaciones</span>
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 font-medium">
                        Complete los campos para registrar nuevas coordinaciones.
                    </p>
                </div>

                <div className="p-6">
                    {/* GRID DEL FORMULARIO */}
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
                        <div className="md:col-span-1">
                            <label className={labelClass}>Matrícula</label>
                            <input
                                name="matricula"
                                value={localForm.matricula}
                                onChange={handleChange}
                                placeholder="Ej. XA-ABC"
                                className={inputClass}
                            />
                        </div>
                        <div className="md:col-span-1">
                            <label className={labelClass}>Descripción</label>
                            <input
                                name="descripcion"
                                value={localForm.descripcion}
                                onChange={handleChange}
                                placeholder="Concepto"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Fecha</label>
                            <input
                                type="date"
                                name="fecha"
                                value={localForm.fecha}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Hora</label>
                            <input
                                type="time"
                                name="hora"
                                value={localForm.hora}
                                onChange={handleChange}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Notas</label>
                            <input
                                name="notas"
                                value={localForm.notas}
                                onChange={handleChange}
                                placeholder="Opcional"
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button
                            type="button"
                            onClick={agregarRegistro}
                            className="w-full md:w-auto inline-flex items-center justify-center rounded-lg bg-sky-600 px-10 py-3 text-sm font-bold text-white shadow-lg shadow-sky-200 transition-all hover:bg-sky-700 active:scale-95"
                        >
                            + Agregar a la lista
                        </button>
                    </div>

                    {/* TABLA */}
                    {form.HotTrasComiCoor?.length > 0 && (
                        <div className="mt-10 overflow-hidden rounded-xl border border-slate-200">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700">
                                        <th className="px-4 py-3 text-left font-bold">Matrícula</th>
                                        <th className="px-4 py-3 text-left font-bold">Descripción</th>
                                        <th className="px-4 py-3 text-left font-bold">Fecha</th>
                                        <th className="px-4 py-3 text-left font-bold">Hora</th>
                                        <th className="px-4 py-3 text-left font-bold">Notas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {form.HotTrasComiCoor.map((r: Registro, i: number) => (
                                        <tr key={i} className="hover:bg-slate-50">
                                            <td className="px-4 py-4 font-bold text-slate-800">{r.matricula}</td>
                                            <td className="px-4 py-4 text-slate-600">{r.descripcion}</td>
                                            <td className="px-4 py-4 text-slate-600">{r.fecha}</td>
                                            <td className="px-4 py-4 text-slate-600">{r.hora}</td>
                                            <td className="px-4 py-4 text-slate-500 italic">{r.notas || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>

            {/* SECCIÓN DE TAREAS - TARJETAS MÁS ROBUSTAS */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {EQUIPOS.map(({ id, label, sublabel }) => (
                    <label
                        key={id}
                        className={`group relative flex cursor-pointer flex-col rounded-xl border-2 p-5 transition-all ${
                            form[id]
                            ? "border-sky-600 bg-sky-50 shadow-md shadow-sky-100"
                            : "border-slate-300 bg-white hover:border-sky-400"
                        }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className="pr-2">
                                <span className={`text-sm font-black ${form[id] ? "text-sky-800" : "text-slate-800"}`}>
                                    {label}
                                </span>
                                <p className="mt-1 text-[11px] leading-tight text-slate-500">
                                    {sublabel}
                                </p>
                            </div>
                            <div className="flex h-6 w-6 items-center justify-center">
                                <input
                                    type="checkbox"
                                    checked={!!form[id]}
                                    onChange={() => updateField(id, !form[id])}
                                    className="h-6 w-6 rounded border-slate-400 text-sky-600 focus:ring-sky-500"
                                />
                            </div>
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );
}
