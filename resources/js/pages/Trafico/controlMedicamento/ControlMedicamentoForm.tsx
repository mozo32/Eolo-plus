import { useState } from "react";

const DIAS = [
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
    "Domingo",
];

const MEDICAMENTOS = [
    "Ketorolaco",
    "Tramadol",
    "Paracetamol",
    "Buscapina",
    "Aspirina",
    "Micropore",
    "Alcohol",
    "Isodine",
];

export default function ControlMedicamentoForm() {
    const [form, setForm] = useState<any>({});

    const updateField = (path: string, value: any) => {
        setForm((prev: any) => {
            const keys = path.split(".");
            const updated = { ...prev };
            let current = updated;

            keys.forEach((k, i) => {
                if (i === keys.length - 1) {
                    current[k] = value;
                } else {
                    current[k] = { ...(current[k] || {}) };
                    current = current[k];
                }
            });

            return updated;
        });
    };

    return (
        <div className="space-y-6">
            <h2 className="text-center text-lg font-extrabold uppercase tracking-widest text-[#00677F]">
                Control Semanal de Medicamentos
            </h2>

            {MEDICAMENTOS.map((med) => (
                <div
                    key={med}
                    className="rounded-xl border border-slate-300 bg-white p-6 shadow"
                >
                    {/* HEADER */}
                    <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-sm font-extrabold uppercase text-[#00677F]">
                            {med}
                        </h3>
                    </div>

                    {/* INFO GENERAL */}
                    <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                        <input
                            placeholder="Cantidad"
                            className="input"
                            onChange={(e) =>
                                updateField(`${med}.cantidad`, e.target.value)
                            }
                        />
                        <input
                            placeholder="Nombre"
                            className="input"
                            onChange={(e) =>
                                updateField(`${med}.nombre`, e.target.value)
                            }
                        />
                        <input
                            placeholder="Firma"
                            className="input"
                            onChange={(e) =>
                                updateField(`${med}.firmaFinal`, e.target.value)
                            }
                        />
                        <input
                            type="date"
                            className="input"
                            onChange={(e) =>
                                updateField(`${med}.fecha`, e.target.value)
                            }
                        />
                    </div>

                    {/* CONTROL SEMANAL */}
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-[#E6F2F6]">
                                    <th className="border px-3 py-2 text-left">
                                        Día
                                    </th>
                                    <th className="border px-3 py-2">Inicio</th>
                                    <th className="border px-3 py-2">Fin</th>
                                    <th className="border px-3 py-2">Firma</th>
                                </tr>
                            </thead>
                            <tbody>
                                {DIAS.map((dia) => (
                                    <tr key={dia}>
                                        <td className="border px-3 py-2 font-semibold">
                                            {dia}
                                        </td>
                                        <td className="border px-2 py-1">
                                            <input
                                                className="input"
                                                onChange={(e) =>
                                                    updateField(
                                                        `${med}.${dia}.inicio`,
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </td>
                                        <td className="border px-2 py-1">
                                            <input
                                                className="input"
                                                onChange={(e) =>
                                                    updateField(
                                                        `${med}.${dia}.fin`,
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </td>
                                        <td className="border px-2 py-1">
                                            <input
                                                className="input"
                                                onChange={(e) =>
                                                    updateField(
                                                        `${med}.${dia}.firma`,
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => console.log("CONTROL:", form)}
                    className="rounded-md bg-[#00677F] px-10 py-3 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-[#00586D]"
                >
                    Guardar Control
                </button>
            </div>
        </div>
    );
}
