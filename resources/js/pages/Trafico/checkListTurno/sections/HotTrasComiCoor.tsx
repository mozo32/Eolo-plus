import { useState } from "react";

const EQUIPOS = [
    {
        id: "revision_base_operaciones",
        label:
            "Revisión de Base de Operaciones (Completar Operaciones y revisar que no tenga errores)",
    },
    {
        id: "envia_informe_diario",
        label: "Se Envía Informe Diario (Antes de la 1:00 am)",
    },
    {
        id: "envia_resumen_semanal",
        label: "Se Envía Resumen Semanal (Solo Jueves, antes de las 9:00 pm)",
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
        if (
            !localForm.matricula ||
            !localForm.descripcion ||
            !localForm.fecha ||
            !localForm.hora
        ) {
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

    const inputClass =
        "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm " +
        "text-slate-700 shadow-sm outline-none " +
        "focus:border-[#00677F] focus:ring-2 focus:ring-[#00677F]/30";

    const labelClass =
        "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600";

    return (
        <>
            {/* CARD PRINCIPAL */}
            <div className="rounded-xl border border-slate-300 bg-white p-6 shadow space-y-6">
                <h3 className="border-l-4 border-[#00677F] pl-3 text-sm font-extrabold uppercase tracking-widest text-[#00677F]">
                    Hoteles / Traslados / Comisiones / Coordinaciones
                </h3>

                <p className="rounded-md border border-[#00677F] bg-[#E6F2F6] px-4 py-2 text-sm text-[#004B5C]">
                    Anotar cualquier coordinación que se haya realizado para días
                    posteriores al turno.
                </p>

                {/* FORMULARIO */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                    <div>
                        <label className={labelClass}>Matrícula</label>
                        <input
                            name="matricula"
                            value={localForm.matricula}
                            onChange={handleChange}
                            placeholder="Ej. XA-ABC"
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Descripción</label>
                        <input
                            name="descripcion"
                            value={localForm.descripcion}
                            onChange={handleChange}
                            placeholder="Descripción"
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
                            placeholder="Notas adicionales"
                            className={inputClass}
                        />
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={agregarRegistro}
                        className="rounded-md bg-[#00677F] px-6 py-2 text-sm font-bold text-white shadow hover:bg-[#004B5C]"
                    >
                        Agregar
                    </button>
                </div>

                {/* TABLA */}
                {form.HotTrasComiCoor?.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-[#E6F2F6] text-[#004B5C]">
                                    <th className="border px-3 py-2 text-left">Matrícula</th>
                                    <th className="border px-3 py-2 text-left">Descripción</th>
                                    <th className="border px-3 py-2 text-left">Fecha</th>
                                    <th className="border px-3 py-2 text-left">Hora</th>
                                    <th className="border px-3 py-2 text-left">Notas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {form.HotTrasComiCoor.map((r: Registro, i: number) => (
                                    <tr key={i} className="hover:bg-slate-50">
                                        <td className="border px-3 py-2">{r.matricula}</td>
                                        <td className="border px-3 py-2">{r.descripcion}</td>
                                        <td className="border px-3 py-2">{r.fecha}</td>
                                        <td className="border px-3 py-2">{r.hora}</td>
                                        <td className="border px-3 py-2">{r.notas}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* CHECKBOXES */}
            <div className="mt-6 rounded-xl border-2 border-[#00677F] bg-[#E6F2F6] p-6">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {EQUIPOS.map(({ id, label }) => (
                        <label
                            key={id}
                            className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold hover:shadow"
                        >
                            <input
                                type="checkbox"
                                checked={!!form[id]}
                                onChange={() => updateField(id, !form[id])}
                                className="h-5 w-5 accent-[#00677F]"
                            />
                            {label}
                        </label>
                    ))}
                </div>
            </div>
        </>
    );
}
