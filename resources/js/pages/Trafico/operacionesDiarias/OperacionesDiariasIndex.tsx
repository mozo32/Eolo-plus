import { useState, useEffect } from "react";
import { fetchOperacionesDiarias } from "@/stores/apiOperacionesDiarias";

type Operacion = {
    id: number;
    matricula: string;
    equipo: string;
    hora: string;
    lugar: string;
    pax: number;
};

type OperacionesResponse = {
    fecha: string;
    llegadas: Operacion[];
    salidas: Operacion[];
};
type Props = {
    refreshKey: number;
};
export default function OperacionesDiariasIndex({ refreshKey }: Props) {
    const [fecha, setFecha] = useState<string>("2026-01-28");
    const [data, setData] = useState<OperacionesResponse>({
        fecha: "",
        llegadas: [],
        salidas: [],
    });

    const filas = Math.max(data.llegadas.length, data.salidas.length);

    useEffect(() => {
        fetchOperacionesDiarias({ fecha })
            .then(setData)
            .catch(console.error);
    }, [fecha, refreshKey]);

    return (
        <div className="mx-auto max-w-7xl space-y-4 rounded-xl border border-slate-300 bg-white p-6 shadow">
            {/* FECHA */}
            <div className="text-center">
                <h2 className="text-lg font-extrabold uppercase">
                    Operaciones Diarias
                </h2>
                <div className="flex justify-center">
                    <input
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        className="rounded-md border border-slate-400 px-4 py-2 text-sm font-semibold text-slate-700 focus:border-[#00677F] focus:outline-none"
                    />
                </div>
            </div>

            {/* TABLA */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-[#E6F2F6]">
                            <th colSpan={5} className="border px-3 py-2 text-center font-bold">
                                LLEGADA
                            </th>
                            <th className="border bg-slate-100"></th>
                            <th colSpan={5} className="border px-3 py-2 text-center font-bold">
                                SALIDA
                            </th>
                        </tr>

                        <tr className="bg-slate-50">
                            {["Matrícula", "Equipo", "Hora", "Procedencia", "Pax"].map((h) => (
                                <th key={h} className="border px-2 py-1">{h}</th>
                            ))}
                            <th className="border bg-slate-100"></th>
                            {["Matrícula", "Equipo", "Hora", "Destino", "Pax"].map((h) => (
                                <th key={h} className="border px-2 py-1">{h}</th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {filas === 0 && (
                            <tr>
                                <td colSpan={11} className="border py-4 text-center text-slate-500">
                                    No hay operaciones para esta fecha
                                </td>
                            </tr>
                        )}

                        {Array.from({ length: filas }).map((_, index) => {
                            const llegada = data.llegadas[index];
                            const salida = data.salidas[index];

                            return (
                                <tr key={index} className="hover:bg-slate-50">
                                    {/* LLEGADA */}
                                    {llegada ? (
                                        <>
                                            <td className="border px-2 py-1">{llegada.matricula}</td>
                                            <td className="border px-2 py-1">{llegada.equipo}</td>
                                            <td className="border px-2 py-1">{llegada.hora}</td>
                                            <td className="border px-2 py-1">{llegada.lugar}</td>
                                            <td className="border px-2 py-1 text-center">{llegada.pax}</td>
                                        </>
                                    ) : (
                                        <td colSpan={5} className="border"></td>
                                    )}

                                    <td className="border bg-slate-100"></td>

                                    {/* SALIDA */}
                                    {salida ? (
                                        <>
                                            <td className="border px-2 py-1">{salida.matricula}</td>
                                            <td className="border px-2 py-1">{salida.equipo}</td>
                                            <td className="border px-2 py-1">{salida.hora}</td>
                                            <td className="border px-2 py-1">{salida.lugar}</td>
                                            <td className="border px-2 py-1 text-center">{salida.pax}</td>
                                        </>
                                    ) : (
                                        <td colSpan={5} className="border"></td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
