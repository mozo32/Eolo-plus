import { useState } from "react";

type Operacion = {
    llegada: {
        matricula: string;
        equipo: string;
        hora: string;
        procedencia: string;
        pax: string;
    };
    salida: {
        matricula: string;
        equipo: string;
        hora: string;
        destino: string;
        pax: string;
    };
};

export default function OperacionesDiariasForm() {
    const [fecha, setFecha] = useState("");
    const [operaciones, setOperaciones] = useState<Operacion[]>([
        {
            llegada: {
                matricula: "",
                equipo: "",
                hora: "",
                procedencia: "",
                pax: "",
            },
            salida: {
                matricula: "",
                equipo: "",
                hora: "",
                destino: "",
                pax: "",
            },
        },
    ]);

    const agregarFila = () => {
        setOperaciones((prev) => [
            ...prev,
            {
                llegada: {
                    matricula: "",
                    equipo: "",
                    hora: "",
                    procedencia: "",
                    pax: "",
                },
                salida: {
                    matricula: "",
                    equipo: "",
                    hora: "",
                    destino: "",
                    pax: "",
                },
            },
        ]);
    };

    const updateField = (
        index: number,
        tipo: "llegada" | "salida",
        campo: string,
        value: string
    ) => {
        setOperaciones((prev) => {
            const copia = [...prev];
            copia[index] = {
                ...copia[index],
                [tipo]: {
                    ...copia[index][tipo],
                    [campo]: value,
                },
            };
            return copia;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log({
            fecha,
            operaciones,
        });
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="mx-auto max-w-7xl space-y-6 rounded-xl border border-slate-300 bg-white p-6 shadow"
        >
            {/* ENCABEZADO */}
            <div className="text-center space-y-2">
                <h2 className="text-lg font-extrabold uppercase">
                    Registro de Operaciones Diarias
                </h2>
                <p className="text-sm font-semibold uppercase text-slate-600">
                    Área de Tráfico
                </p>
            </div>

            <div className="flex justify-start max-w-xs">
                <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full rounded-md border-2 border-slate-400 px-4 py-2 text-sm font-bold focus:border-[#00677F] focus:outline-none"
                />
            </div>

            {/* TABLA */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-[#E6F2F6]">
                            <th colSpan={5} className="border px-3 py-2 text-center font-bold">
                                LLEGADA
                            </th>
                            <th className="border px-2 py-2 bg-slate-100"></th>
                            <th colSpan={5} className="border px-3 py-2 text-center font-bold">
                                SALIDA
                            </th>
                        </tr>
                        <tr className="bg-slate-50">
                            {["Matrícula", "Equipo", "Hora", "Procedencia", "Pax"].map((h) => (
                                <th key={h} className="border px-2 py-1">
                                    {h}
                                </th>
                            ))}
                            <th className="border bg-slate-100"></th>
                            {["Matrícula", "Equipo", "Hora", "Destino", "Pax"].map((h) => (
                                <th key={h} className="border px-2 py-1">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {operaciones.map((op, index) => (
                            <tr key={index}>
                                {/* LLEGADA */}
                                <td className="border">
                                    <input
                                        className="w-full px-2 py-1"
                                        value={op.llegada.matricula}
                                        onChange={(e) =>
                                            updateField(index, "llegada", "matricula", e.target.value)
                                        }
                                    />
                                </td>
                                <td className="border">
                                    <input
                                        className="w-full px-2 py-1"
                                        value={op.llegada.equipo}
                                        onChange={(e) =>
                                            updateField(index, "llegada", "equipo", e.target.value)
                                        }
                                    />
                                </td>
                                <td className="border">
                                    <input
                                        type="time"
                                        className="w-full px-2 py-1"
                                        value={op.llegada.hora}
                                        onChange={(e) =>
                                            updateField(index, "llegada", "hora", e.target.value)
                                        }
                                    />
                                </td>
                                <td className="border">
                                    <input
                                        className="w-full px-2 py-1"
                                        value={op.llegada.procedencia}
                                        onChange={(e) =>
                                            updateField(index, "llegada", "procedencia", e.target.value)
                                        }
                                    />
                                </td>
                                <td className="border">
                                    <input
                                        type="number"
                                        className="w-full px-2 py-1"
                                        value={op.llegada.pax}
                                        onChange={(e) =>
                                            updateField(index, "llegada", "pax", e.target.value)
                                        }
                                    />
                                </td>

                                {/* SEPARADOR */}
                                <td className="border bg-slate-100"></td>

                                {/* SALIDA */}
                                <td className="border">
                                    <input
                                        className="w-full px-2 py-1"
                                        value={op.salida.matricula}
                                        onChange={(e) =>
                                            updateField(index, "salida", "matricula", e.target.value)
                                        }
                                    />
                                </td>
                                <td className="border">
                                    <input
                                        className="w-full px-2 py-1"
                                        value={op.salida.equipo}
                                        onChange={(e) =>
                                            updateField(index, "salida", "equipo", e.target.value)
                                        }
                                    />
                                </td>
                                <td className="border">
                                    <input
                                        type="time"
                                        className="w-full px-2 py-1"
                                        value={op.salida.hora}
                                        onChange={(e) =>
                                            updateField(index, "salida", "hora", e.target.value)
                                        }
                                    />
                                </td>
                                <td className="border">
                                    <input
                                        className="w-full px-2 py-1"
                                        value={op.salida.destino}
                                        onChange={(e) =>
                                            updateField(index, "salida", "destino", e.target.value)
                                        }
                                    />
                                </td>
                                <td className="border">
                                    <input
                                        type="number"
                                        className="w-full px-2 py-1"
                                        value={op.salida.pax}
                                        onChange={(e) =>
                                            updateField(index, "salida", "pax", e.target.value)
                                        }
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ACCIONES */}
            <div className="flex justify-between">
                <button
                    type="button"
                    onClick={agregarFila}
                    className="rounded-md border px-4 py-2 text-sm font-semibold"
                >
                    + Agregar fila
                </button>

                <button
                    type="submit"
                    className="rounded-md bg-[#00677F] px-8 py-2 text-sm font-bold text-white hover:bg-[#00586D]"
                >
                    Guardar Registro
                </button>
            </div>
        </form>
    );
}
