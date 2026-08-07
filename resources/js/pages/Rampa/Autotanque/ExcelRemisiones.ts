import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const ASA_EXCEL_COLORS = {
    header: '003E51',
    white: 'FFFFFF',
    border: 'E5E7EB'
} as const;

export const VENTAS_ASA_EXCEL = {
    nombre: 'Ventas ASA',
    columnas: [
        { header: 'FOLIO', key: 'folio', width: 15 },
        { header: 'FECHA', key: 'fecha', width: 22 },
        { header: 'MATRÍCULA', key: 'matricula', width: 12 },
        { header: 'SALIDA (LTS)', key: 'litros', width: 15 },
        { header: 'ORD. VTA', key: 'vta', width: 12 },
        { header: 'FACTURA', key: 'factura', width: 15 },
        { header: 'PRECIO DE VENTA EOLO', key: 'precioVenta', width: 22 },
        { header: 'IMPORTE', key: 'importe', width: 18 },
        { header: 'CLIENTE', key: 'cliente', width: 25 },
        { header: 'FORMA DE PAGO', key: 'formaPago', width: 15 },
        { header: 'MES DE REFERENCIA', key: 'mes', width: 18 },
        { header: 'ESTATUS', key: 'status', width: 12 }
    ]
} as const;

export const COMPRAS_ASA_EXCEL = {
    nombre: 'Compras ASA',
    columnas: [
        { header: 'FOLIO', key: 'folio', width: 15 },
        { header: 'FECHA', key: 'fecha', width: 22 },
        { header: 'LITROS', key: 'litros', width: 15 },
        { header: 'FACTURA', key: 'factura', width: 15 },
        { header: 'PRECIO DE COMPRA POR LT', key: 'precioVenta', width: 25 },
        { header: 'COSTO ASA', key: 'importe', width: 20 }
    ]
} as const;

export interface FilaVentaASAExcel {
    folio: string;
    fecha: Date | null;
    matricula: string;
    litros: number;
    vta: string;
    factura: string;
    precioVenta: number;
    importe: number;
    cliente: string;
    formaPago: string;
    mes: string;
    status: string;
}

export interface FilaCompraASAExcel {
    folio: string;
    fecha: Date | null;
    litros: number;
    factura: string;
    precioVenta: number;
    importe: number;
}

export interface ReporteASAExcel {
    blob: Blob;
    ventas: FilaVentaASAExcel[];
    compras: FilaCompraASAExcel[];
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

    const [, anio, mes, dia, hora = '00', minuto = '00'] = match;

    return new Date(Date.UTC(
        Number(anio),
        Number(mes) - 1,
        Number(dia),
        Number(hora),
        Number(minuto),
        0
    ));
};

const parseNumero = (value: any): number => {
    if (value === null || value === undefined || value === '') return 0;

    const numero = Number(String(value).replace(/,/g, '').replace(/\s/g, ''));
    return Number.isNaN(numero) ? 0 : numero;
};

const normalizarTexto = (value: any): string =>
    value === null || value === undefined ? '' : String(value);

const formatearMesReferencia = (value: any): string => {
    if (value === null || value === undefined || value === '') return '';

    const meses: Record<string, string> = {
        january: 'Enero',
        february: 'Febrero',
        march: 'Marzo',
        april: 'Abril',
        may: 'Mayo',
        june: 'Junio',
        july: 'Julio',
        august: 'Agosto',
        september: 'Septiembre',
        october: 'Octubre',
        november: 'Noviembre',
        december: 'Diciembre',
        enero: 'Enero',
        febrero: 'Febrero',
        marzo: 'Marzo',
        abril: 'Abril',
        mayo: 'Mayo',
        junio: 'Junio',
        julio: 'Julio',
        agosto: 'Agosto',
        septiembre: 'Septiembre',
        octubre: 'Octubre',
        noviembre: 'Noviembre',
        diciembre: 'Diciembre'
    };

    const obtenerNombreMes = (numeroMes: number): string => {
        if (numeroMes < 1 || numeroMes > 12) return '';

        const fecha = new Date(Date.UTC(2026, numeroMes - 1, 1));
        const resultado = new Intl.DateTimeFormat('es-MX', {
            month: 'long',
            timeZone: 'UTC'
        }).format(fecha);

        return resultado.charAt(0).toUpperCase() + resultado.slice(1);
    };

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const mes = obtenerNombreMes(value.getUTCMonth() + 1);
        return `${mes} de ${value.getUTCFullYear()}`;
    }

    const texto = String(value).trim();
    const fechaAnioMes = texto.match(
        /^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?/
    );

    if (fechaAnioMes) {
        const [, anio, numeroMes] = fechaAnioMes;
        const mes = obtenerNombreMes(Number(numeroMes));
        return mes ? `${mes} de ${anio}` : texto;
    }

    const fechaMesAnio = texto.match(/^(\d{1,2})[-/](\d{4})$/);

    if (fechaMesAnio) {
        const [, numeroMes, anio] = fechaMesAnio;
        const mes = obtenerNombreMes(Number(numeroMes));
        return mes ? `${mes} de ${anio}` : texto;
    }

    if (/^(0?[1-9]|1[0-2])$/.test(texto)) {
        return obtenerNombreMes(Number(texto));
    }

    const nombreMes = texto.match(
        /^([a-záéíóúñ]+)(?:\s+(?:de\s+)?(\d{4}))?$/i
    );

    if (nombreMes) {
        const nombreOriginal = nombreMes[1].toLowerCase();
        const anio = nombreMes[2];
        const mesTraducido = meses[nombreOriginal];

        if (mesTraducido) {
            return anio ? `${mesTraducido} de ${anio}` : mesTraducido;
        }
    }

    return texto;
};

export const formatearFechaASAExcel = (fecha: Date | null): string => {
    if (!fecha) return '';

    const dia = String(fecha.getUTCDate()).padStart(2, '0');
    const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const anio = fecha.getUTCFullYear();
    const hora = String(fecha.getUTCHours()).padStart(2, '0');
    const minuto = String(fecha.getUTCMinutes()).padStart(2, '0');

    return `${dia}/${mes}/${anio} ${hora}:${minuto}`;
};

export const formatearLitrosASAExcel = (value: number): string =>
    new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0
    }).format(value);

export const formatearMonedaASAExcel = (value: number): string =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);

const normalizarDatos = (datos: any[]) => {
    const ventas: FilaVentaASAExcel[] = [];
    const compras: FilaCompraASAExcel[] = [];

    datos.forEach((item) => {
        if (item.tipo === 'R') {
            ventas.push({
                folio: normalizarTexto(item.folio),
                fecha: parseFechaExcel(item.fecha),
                matricula: normalizarTexto(item.matricula),
                litros: Math.round(parseNumero(item.litros)),
                vta: normalizarTexto(item.vta),
                factura: normalizarTexto(item.factura),
                precioVenta: parseNumero(item.precio_venta),
                importe: parseNumero(item.importe),
                cliente: normalizarTexto(item.cliente),
                formaPago: normalizarTexto(item.forma_pago),
                mes: formatearMesReferencia(item.mes),
                status: item.status === 'A'
                    ? 'Activo'
                    : normalizarTexto(item.status)
            });
            return;
        }

        compras.push({
            folio: normalizarTexto(item.folio),
            fecha: parseFechaExcel(item.fecha),
            litros: Math.round(parseNumero(item.litros)),
            factura: normalizarTexto(item.factura),
            precioVenta: parseNumero(item.precio_venta),
            importe: parseNumero(item.importe)
        });
    });

    return { ventas, compras };
};

const formatHeader = (worksheet: ExcelJS.Worksheet) => {
    const headerRow = worksheet.getRow(1);
    headerRow.height = 24;

    headerRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: toArgb(ASA_EXCEL_COLORS.header) }
        };
        cell.font = {
            color: { argb: toArgb(ASA_EXCEL_COLORS.white) },
            bold: true
        };
        cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true
        };
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };
    });
};

const aplicarFormatoFilas = (worksheet: ExcelJS.Worksheet) => {
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        row.height = 20;

        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true
            };
            cell.border = {
                top: {
                    style: 'thin',
                    color: { argb: toArgb(ASA_EXCEL_COLORS.border) }
                },
                left: {
                    style: 'thin',
                    color: { argb: toArgb(ASA_EXCEL_COLORS.border) }
                },
                bottom: {
                    style: 'thin',
                    color: { argb: toArgb(ASA_EXCEL_COLORS.border) }
                },
                right: {
                    style: 'thin',
                    color: { argb: toArgb(ASA_EXCEL_COLORS.border) }
                }
            };
        });
    });
};

export const prepararExcelRemisiones = async (
    datos: any[]
): Promise<ReporteASAExcel> => {
    const { ventas, compras } = normalizarDatos(datos);
    const workbook = new ExcelJS.Workbook();
    const sheetVentas = workbook.addWorksheet(VENTAS_ASA_EXCEL.nombre);
    const sheetCompras = workbook.addWorksheet(COMPRAS_ASA_EXCEL.nombre);

    sheetVentas.columns = VENTAS_ASA_EXCEL.columnas.map((columna) => ({
        header: columna.header,
        key: columna.key,
        width: columna.width
    }));
    sheetCompras.columns = COMPRAS_ASA_EXCEL.columnas.map((columna) => ({
        header: columna.header,
        key: columna.key,
        width: columna.width
    }));

    formatHeader(sheetVentas);
    formatHeader(sheetCompras);

    ventas.forEach((fila) => sheetVentas.addRow(fila));
    compras.forEach((fila) => sheetCompras.addRow(fila));

    aplicarFormatoFilas(sheetVentas);
    aplicarFormatoFilas(sheetCompras);

    sheetVentas.getColumn('fecha').numFmt = 'dd/mm/yyyy hh:mm';
    sheetCompras.getColumn('fecha').numFmt = 'dd/mm/yyyy hh:mm';

    sheetVentas.getColumn('litros').numFmt = '#,##0';
    sheetVentas.getColumn('precioVenta').numFmt = '$#,##0.00';
    sheetVentas.getColumn('importe').numFmt = '$#,##0.00';

    sheetCompras.getColumn('litros').numFmt = '#,##0';
    sheetCompras.getColumn('precioVenta').numFmt = '$#,##0.00';
    sheetCompras.getColumn('importe').numFmt = '$#,##0.00';

    sheetVentas.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: VENTAS_ASA_EXCEL.columnas.length }
    };
    sheetCompras.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: COMPRAS_ASA_EXCEL.columnas.length }
    };

    sheetVentas.views = [{ state: 'frozen', ySplit: 1 }];
    sheetCompras.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const bytes = new Uint8Array(buffer);
    const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    return { blob, ventas, compras };
};

export const descargarExcelRemisiones = (blob: Blob): void => {
    saveAs(
        blob,
        `Reporte_ASA_${new Date().toISOString().split('T')[0]}.xlsx`
    );
};

export const ExcelRemisiones = async (datos: any[]): Promise<void> => {
    const reporte = await prepararExcelRemisiones(datos);
    descargarExcelRemisiones(reporte.blob);
};
