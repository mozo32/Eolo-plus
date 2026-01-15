import React from "react";
import { exportPernoctaExcel } from "./exportPernoctaExcel";

interface Props {
    mes: string;
    anio: string;
    days: number;
    rows: any[];
}

export default function PernoctaExportButton({
    mes,
    anio,
    days,
    rows,
}: Props) {
    return (
        <button
            onClick={() => exportPernoctaExcel(mes, anio, days, rows)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
            Exportar Excel
        </button>
    );
}
