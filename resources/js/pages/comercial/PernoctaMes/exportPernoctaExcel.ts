import * as XLSX from "xlsx-js-style";
import Swal from "sweetalert2";

type Row = {
    matricula: string;
    aeronave: string;
    estatus: string;
    categoria: string;
    ubicacion: string;
    dias: Record<number, 0 | 1>;
};

export function exportPernoctaExcel(
    mes: string,
    anio: string,
    days: number,
    rows: Row[]
) {
    const DIAS_START_COL = 5;

    const header = [
        "MATRÍCULA",
        "AERONAVE",
        "ESTATUS",
        "CATEGORÍA",
        "UBICACIÓN",
        ...Array.from({ length: days }, (_, i) => `${i + 1}`),
        "TOTAL",
    ];

    const data = rows.map((row) => {
        const dias = Array.from({ length: days }, (_, i) => row.dias[i + 1] ?? 0);
        const total = Object.values(row.dias).reduce<number>((a, b) => a + b, 0);

        return [
            row.matricula,
            row.aeronave,
            row.estatus,
            row.categoria,
            row.ubicacion,
            ...dias,
            total,
        ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([
        [`${mes.toUpperCase()} ${anio}`],
        [],
        header,
        ...data,
    ]);

    worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } },
    ];

    worksheet["!cols"] = [
        { wch: 12 },
        { wch: 10 },
        { wch: 10 },
        { wch: 12 },
        { wch: 10 },
        ...Array.from({ length: days }, () => ({ wch: 4 })),
        { wch: 6 },
    ];

    worksheet["!rows"] = [
        { hpt: 22 },
        { hpt: 8 },
        { hpt: 18 },
        ...Array.from({ length: rows.length }, () => ({ hpt: 16 })),
    ];

    worksheet["!freeze"] = { xSplit: DIAS_START_COL, ySplit: 3 };

    const range = XLSX.utils.decode_range(worksheet["!ref"]!);

    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: 2, c: C })];
        if (cell) {
            cell.s = {
                fill: { fgColor: { rgb: "0, 62, 81" } },
                font: { bold: true, color: { rgb: "FFFFFF" } },
                alignment: { horizontal: "center" },
                border: {
                    top: { style: "thin" },
                    bottom: { style: "thin" },
                    left: { style: "thin" },
                    right: { style: "thin" },
                },
            };
        }
    }

    for (let R = 3; R <= range.e.r; ++R) {
        for (let C = DIAS_START_COL; C < DIAS_START_COL + days; ++C) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
            if (!cell) continue;

            cell.s = {
                fill: {
                    fgColor: { rgb: cell.v === 1 ? "C6E0B4" : "BDD7EE" },
                },
                alignment: { horizontal: "center" },
                border: {
                    top: { style: "thin" },
                    bottom: { style: "thin" },
                    left: { style: "thin" },
                    right: { style: "thin" },
                },
            };
        }

        const totalCell = worksheet[
            XLSX.utils.encode_cell({ r: R, c: DIAS_START_COL + days })
        ];

        if (totalCell) {
            totalCell.s = {
                fill: { fgColor: { rgb: "FFD966" } },
                font: { bold: true },
                alignment: { horizontal: "center" },
                border: {
                    top: { style: "thin" },
                    bottom: { style: "thin" },
                    left: { style: "thin" },
                    right: { style: "thin" },
                },
            };
        }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, mes);
    XLSX.writeFile(workbook, `Pernocta_${anio}_${mes}.xlsx`);

    Swal.fire({
        icon: "success",
        title: "Excel descargado",
        text: "El archivo se descargó correctamente",
        timer: 2000,
        showConfirmButton: false,
    });
}
