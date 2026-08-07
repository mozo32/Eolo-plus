import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const AUTOTANQUE_EXCEL_HEADERS = [
    'N°',
    'RESPONSABLE INICIO',
    'FECHA INICIO',
    'CM INICIAL',
    'LITROS INICIAL',
    'TOTALIZADOR INI',
    'RESPONSABLE CIERRE',
    'FECHA CIERRE',
    'CM CIERRE',
    'LITROS CIERRE',
    'TOTALIZADOR CIERRE',
    'DIFERENCIA (LTS)'
] as const;

export const AUTOTANQUE_EXCEL_COLUMN_WIDTHS = [
    6,
    25,
    18,
    14,
    16,
    18,
    25,
    18,
    14,
    16,
    18,
    18
] as const;

export const AUTOTANQUE_EXCEL_COLORS = {
    title: '1E293B',
    header: '4F46E5',
    white: 'FFFFFF',
    border: 'E2E8F0',
    negative: 'DC2626'
} as const;

export interface FilaAutotanqueExcel {
    numero: number;
    responsableInicio: string;
    fechaInicio: Date | null;
    cmInicial: number;
    litrosInicial: number;
    totalizadorInicial: number;
    responsableCierre: string;
    fechaCierre: Date | null;
    cmCierre: number;
    litrosCierre: number;
    totalizadorCierre: number;
    diferencia: number;
}

export interface ReporteAutotanqueExcel {
    blob: Blob;
    filas: FilaAutotanqueExcel[];
}

const toArgb = (hex: string) => `FF${hex}`;

const parseFechaExcel = (value: any): Date | null => {
    if (!value) return null;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return new Date(Date.UTC(
            value.getFullYear(),
            value.getMonth(),
            value.getDate(),
            value.getHours(),
            value.getMinutes(),
            0
        ));
    }

    const texto = String(value).trim();
    const match = texto.match(
        /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?/
    );

    if (!match) return null;

    const [, y, m, d, h = '00', min = '00'] = match;

    return new Date(Date.UTC(
        Number(y),
        Number(m) - 1,
        Number(d),
        Number(h),
        Number(min),
        0
    ));
};

const parseNumero = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;

    const numero = Number(String(value).replace(/,/g, '').replace(/\s/g, ''));
    return Number.isNaN(numero) ? 0 : numero;
};

export const formatearFechaAutotanqueExcel = (value: Date | null): string => {
    if (!value) return '';

    const dia = String(value.getUTCDate()).padStart(2, '0');
    const mes = String(value.getUTCMonth() + 1).padStart(2, '0');
    const anio = String(value.getUTCFullYear()).slice(-2);
    const hora = String(value.getUTCHours()).padStart(2, '0');
    const minuto = String(value.getUTCMinutes()).padStart(2, '0');

    return `${dia}/${mes}/${anio} ${hora}:${minuto}`;
};

export const formatearNumeroAutotanqueExcel = (value: number): string =>
    new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0
    }).format(value);

const normalizarRegistros = (registros: any[]): FilaAutotanqueExcel[] =>
    registros.map((item, index) => ({
        numero: index + 1,
        responsableInicio: item.nombre?.toUpperCase() || 'N/A',
        fechaInicio: parseFechaExcel(item.fecha),
        cmInicial: parseNumero(item.cmIni),
        litrosInicial: parseNumero(item.litrosIni),
        totalizadorInicial: parseNumero(item.totalizadorIni),
        responsableCierre: item.nombreCierre?.toUpperCase() || 'PENDIENTE',
        fechaCierre: parseFechaExcel(item.fechaCierre),
        cmCierre: parseNumero(item.cmCierre),
        litrosCierre: parseNumero(item.litrosCierre),
        totalizadorCierre: parseNumero(item.totalizadorCierre),
        diferencia: parseNumero(item.diferenciaFinal)
    }));

const valoresFila = (fila: FilaAutotanqueExcel) => [
    fila.numero,
    fila.responsableInicio,
    fila.fechaInicio,
    fila.cmInicial,
    fila.litrosInicial,
    fila.totalizadorInicial,
    fila.responsableCierre,
    fila.fechaCierre,
    fila.cmCierre,
    fila.litrosCierre,
    fila.totalizadorCierre,
    fila.diferencia
];

export const prepararAutotanqueExcel = async (
    registros: any[]
): Promise<ReporteAutotanqueExcel> => {
    const filas = normalizarRegistros(registros);
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte Autotanque');

    worksheet.mergeCells('A1:L1');

    const mainTitle = worksheet.getCell('A1');
    mainTitle.value = 'REPORTE DE ENTREGA DE TURNO - AUTOTANQUE';
    mainTitle.font = {
        name: 'Arial Black',
        size: 14,
        color: { argb: toArgb(AUTOTANQUE_EXCEL_COLORS.white) }
    };
    mainTitle.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: toArgb(AUTOTANQUE_EXCEL_COLORS.title) }
    };
    mainTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    const startRow = 3;
    const headerRow = worksheet.getRow(startRow);
    headerRow.values = [...AUTOTANQUE_EXCEL_HEADERS];
    headerRow.height = 25;

    headerRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: toArgb(AUTOTANQUE_EXCEL_COLORS.header) }
        };
        cell.font = {
            color: { argb: toArgb(AUTOTANQUE_EXCEL_COLORS.white) },
            bold: true,
            size: 10
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });

    worksheet.columns = AUTOTANQUE_EXCEL_COLUMN_WIDTHS.map((width) => ({
        width
    }));

    filas.forEach((fila) => {
        const row = worksheet.addRow(valoresFila(fila));
        row.height = 22;

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = {
                bottom: {
                    style: 'thin',
                    color: { argb: toArgb(AUTOTANQUE_EXCEL_COLORS.border) }
                }
            };

            if (colNumber === 3 || colNumber === 8) {
                cell.numFmt = 'dd/mm/yy hh:mm';
            }

            if ([4, 5, 6, 9, 10, 11, 12].includes(colNumber)) {
                cell.numFmt = '#,##0';
            }

            if (colNumber === 12 && fila.diferencia < 0) {
                cell.font = {
                    color: { argb: toArgb(AUTOTANQUE_EXCEL_COLORS.negative) },
                    bold: true
                };
            }
        });
    });

    worksheet.autoFilter = {
        from: { row: startRow, column: 1 },
        to: { row: startRow, column: AUTOTANQUE_EXCEL_HEADERS.length }
    };

    worksheet.views = [{ state: 'frozen', ySplit: 3 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const bytes = new Uint8Array(buffer);
    const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    return { blob, filas };
};

export const descargarAutotanqueExcel = (blob: Blob): void => {
    const fechaHoy = new Date().toISOString().split('T')[0];
    saveAs(blob, `Reporte_Autotanque_${fechaHoy}.xlsx`);
};

export const exportarAutotanqueAExcel = async (
    registros: any[]
): Promise<void> => {
    const reporte = await prepararAutotanqueExcel(registros);
    descargarAutotanqueExcel(reporte.blob);
};
