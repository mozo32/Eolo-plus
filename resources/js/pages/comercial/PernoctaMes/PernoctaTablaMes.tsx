import React from "react";
import PernoctaExportButton from "./PernoctaExportButton";

type Row = {
    matricula: string;
    aeronave: string;
    estatus: string;
    categoria: string;
    ubicacion: "H1" | "H2";
    dias: Record<number, 0 | 1>;
};

interface Props {
    mesNombre: string;
    days: number;
    rows: Row[];
}

export default function PernoctaTablaMes({ mesNombre, days, rows }: Props) {
    if (!rows.length) return null;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase">{mesNombre}</h3>

                <PernoctaExportButton
                    mes={mesNombre}
                    anio="2026"
                    days={days}
                    rows={rows}
                />
            </div>

            <div className="relative overflow-x-auto rounded-xl border shadow-sm">
                <table className="min-w-max border-collapse text-xs">
                    <thead className="sticky top-0 z-40">
                        <tr className="bg-[rgb(0,62,81)] text-white">
                            <th className="sticky left-0 z-[60] bg-[rgb(0,62,81)] border px-2 py-1 shadow-right">
                                MATRÍCULA
                            </th>

                            <th className="sticky left-[90px] z-[60] bg-[rgb(0,62,81)] border px-2 py-1 shadow-right">
                                AERONAVE
                            </th>

                            <th className="sticky left-[170px] z-[60] bg-[rgb(0,62,81)] border px-2 py-1 shadow-right">
                                ESTATUS
                            </th>

                            <th className="sticky left-[250px] z-[60] bg-[rgb(0,62,81)] border px-2 py-1 shadow-right">
                                CATEGORÍA
                            </th>

                            {Array.from({ length: days }, (_, i) => (
                                <th
                                    key={i}
                                    className="border px-2 py-1 text-center"
                                >
                                    {i + 1}
                                </th>
                            ))}

                            <th className="sticky right-0 z-50 w-[60px] border bg-yellow-400 px-2 py-1 text-black">
                                TOTAL
                            </th>
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map((row, idx) => {
                            const total = Object.values(row.dias).reduce<number>(
                                (a, b) => a + b,
                                0
                            );

                            return (
                                <tr key={idx} className="odd:bg-gray-50">
                                    <td className="sticky left-1 z-[90] bg-white border px-2 py-1 shadow-right">
                                        {row.matricula}
                                    </td>

                                    <td className="sticky left-[90px] z-[50] bg-white border px-2 py-1 shadow-right">
                                        {row.aeronave}
                                    </td>

                                    <td className="sticky left-[170px] z-[50] bg-white border px-5 py-1 shadow-right">
                                        {row.estatus}
                                    </td>

                                    <td className="sticky left-[250px] z-[50] bg-white border px-5 py-1 shadow-right">
                                        {row.categoria}
                                    </td>

                                    {Array.from({ length: days }, (_, d) => {
                                        const v = row.dias[d + 1] ?? 0;
                                        return (
                                            <td
                                                key={d}
                                                className={`border px-2 py-1 text-center font-semibold ${v === 1
                                                    ? "bg-green-200"
                                                    : "bg-blue-200"
                                                    }`}
                                            >
                                                {v}
                                            </td>
                                        );
                                    })}

                                    <td className="sticky right-0 z-30 border bg-yellow-200 px-2 py-1 text-center font-bold">
                                        {total}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
