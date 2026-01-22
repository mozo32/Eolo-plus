import { useState } from "react";

const EQUIPOS = [
    { id: "revision_base_operaciones", label: "Revisión de Base de Operaciones (Completar Operaciones y revisarr que no tenga errores)" },
    { id: "envia_informe_diario", label: "Se Envía Informe Diario (Antes de la 1:00 am)" },
    { id: "envia_resumen_semanel", label: "Se Envía Resumen Semanal (Solo Jueves, antes de las 9:00 pm)" },
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
        setLocalForm({ ...localForm, [name]: value });
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

    return (
        <>
            <div className="rounded-xl border border-slate-300 bg-white p-6 shadow space-y-6">
                <h3 className="text-sm font-extrabold uppercase tracking-widest text-[#00677F]">
                    Hoteles / Traslados / Comisiones / Coordinaciones
                </h3>

                <p className="rounded-md border border-[#00677F] bg-[#E6F2F6] px-4 py-2 text-sm text-[#004B5C]">
                    Anotar cualquier coordinación que se haya realizado para días
                    posteriores al turno.
                </p>

                {/* FORMULARIO */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                    <input
                        name="matricula"
                        value={localForm.matricula}
                        onChange={handleChange}
                        placeholder="Matrícula"
                        className="input"
                    />

                    <input
                        name="descripcion"
                        value={localForm.descripcion}
                        onChange={handleChange}
                        placeholder="Descripción"
                        className="input"
                    />

                    <input
                        type="date"
                        name="fecha"
                        value={localForm.fecha}
                        onChange={handleChange}
                        className="input"
                    />

                    <input
                        type="time"
                        name="hora"
                        value={localForm.hora}
                        onChange={handleChange}
                        className="input"
                    />

                    <input
                        name="notas"
                        value={localForm.notas}
                        onChange={handleChange}
                        placeholder="Notas"
                        className="input"
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={agregarRegistro}
                        className="rounded-md bg-[#00677F] px-6 py-2 text-sm font-bold text-white hover:bg-[#004B5C]"
                    >
                        Agregar
                    </button>
                </div>

                {/* TABLA */}
                {form.HotTrasComiCoor?.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-[#E6F2F6]">
                                    <th className="border px-3 py-2">Matrícula</th>
                                    <th className="border px-3 py-2">Descripción</th>
                                    <th className="border px-3 py-2">Fecha</th>
                                    <th className="border px-3 py-2">Hora</th>
                                    <th className="border px-3 py-2">Notas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {form.HotTrasComiCoor.map(
                                    (r: Registro, i: number) => (
                                        <tr key={i}>
                                            <td className="border px-3 py-2">{r.matricula}</td>
                                            <td className="border px-3 py-2">{r.descripcion}</td>
                                            <td className="border px-3 py-2">{r.fecha}</td>
                                            <td className="border px-3 py-2">{r.hora}</td>
                                            <td className="border px-3 py-2">{r.notas}</td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <div className="rounded-xl border-2 border-[#00677F] bg-[#E6F2F6] p-6">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {EQUIPOS.map(({ id, label }) => (
                        <label
                            key={id}
                            className="flex items-center gap-3 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold cursor-pointer"
                        >
                            <input
                                type="checkbox"
                                checked={!!form[id]}
                                onChange={() =>
                                    updateField(id, !form[id])
                                }
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
