import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const parseFechaExcel = (value: any) => {
    if (!value) return null;

    if (value instanceof Date && !isNaN(value.getTime())) {
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

    const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?/);

    if (match) {
        const [, anio, mes, dia, hora = '00', minuto = '00'] = match;

        return new Date(Date.UTC(
            Number(anio),
            Number(mes) - 1,
            Number(dia),
            Number(hora),
            Number(minuto),
            0
        ));
    }

    return null;
};

const parseNumero = (value: any) => {
    if (value === null || value === undefined || value === '') return 0;

    const numero = Number(String(value).replace(/,/g, '').replace(/\s/g, ''));

    return isNaN(numero) ? 0 : numero;
};

export const ExcelRemisiones = async (datos: any[]) => {
    const workbook = new ExcelJS.Workbook();

    const sheetVentas = workbook.addWorksheet('Ventas ASA');
    const sheetCompras = workbook.addWorksheet('Compras ASA');

    sheetVentas.columns = [
        { header: 'FOLIO', key: 'folio', width: 15 },
        { header: 'FECHA', key: 'fecha', width: 22 },
        { header: 'MATRÍCULA', key: 'matricula', width: 12 },
        { header: 'SALIDA (LTS)', key: 'litros', width: 15 },
        { header: 'ORD. VTA', key: 'vta', width: 12 },
        { header: 'FACTURA', key: 'factura', width: 15 },
        { header: 'PRECIO DE VENTA EOLO', key: 'precio_venta', width: 22 },
        { header: 'IMPORTE', key: 'importe', width: 18 },
        { header: 'CLIENTE', key: 'cliente', width: 25 },
        { header: 'FORMA DE PAGO', key: 'forma_pago', width: 15 },
        { header: 'MES DE REFERENCIA', key: 'mes', width: 18 },
        { header: 'ESTATUS', key: 'status', width: 12 },
    ];

    sheetCompras.columns = [
        { header: 'FOLIO', key: 'folio', width: 15 },
        { header: 'FECHA', key: 'fecha', width: 22 },
        { header: 'LITROS', key: 'litros', width: 15 },
        { header: 'FACTURA', key: 'factura', width: 15 },
        { header: 'PRECIO DE COMPRA POR LT', key: 'precio_venta', width: 25 },
        { header: 'COSTO ASA', key: 'importe', width: 20 },
    ];

    const formatHeader = (ws: ExcelJS.Worksheet) => {
        const headerRow = ws.getRow(1);

        headerRow.height = 24;

        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF003E51' }
            };

            cell.font = {
                color: { argb: 'FFFFFFFF' },
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

    formatHeader(sheetVentas);
    formatHeader(sheetCompras);

    datos.forEach((item) => {
        if (item.tipo === 'R') {
            sheetVentas.addRow({
                folio: item.folio,
                fecha: parseFechaExcel(item.fecha),
                matricula: item.matricula,
                litros: parseNumero(item.litros),
                vta: item.vta,
                factura: item.factura,
                precio_venta: parseNumero(item.precio_venta),
                importe: parseNumero(item.importe),
                cliente: item.cliente,
                forma_pago: item.forma_pago,
                mes: item.mes,
                status: item.status === 'A' ? 'Activo' : item.status
            });
        } else {
            sheetCompras.addRow({
                folio: item.folio,
                fecha: parseFechaExcel(item.fecha),
                litros: parseNumero(item.litros),
                factura: item.factura,
                precio_venta: parseNumero(item.precio_venta),
                importe: parseNumero(item.importe)
            });
        }
    });

    const aplicarFormatoFilas = (ws: ExcelJS.Worksheet) => {
        ws.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            row.height = 20;

            row.eachCell((cell) => {
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: 'center',
                    wrapText: true
                };

                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                };
            });
        });
    };

    aplicarFormatoFilas(sheetVentas);
    aplicarFormatoFilas(sheetCompras);

    sheetVentas.getColumn('fecha').numFmt = 'dd/mm/yyyy hh:mm';
    sheetCompras.getColumn('fecha').numFmt = 'dd/mm/yyyy hh:mm';

    sheetVentas.getColumn('litros').numFmt = '#,##0.00';
    sheetVentas.getColumn('precio_venta').numFmt = '$#,##0.0000';
    sheetVentas.getColumn('importe').numFmt = '$#,##0.0000';

    sheetCompras.getColumn('litros').numFmt = '#,##0.00';
    sheetCompras.getColumn('precio_venta').numFmt = '$#,##0.0000';
    sheetCompras.getColumn('importe').numFmt = '$#,##0.0000';

    sheetVentas.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: 12 }
    };

    sheetCompras.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: 6 }
    };

    sheetVentas.views = [{ state: 'frozen', ySplit: 1 }];
    sheetCompras.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(blob, `Reporte_ASA_${new Date().toISOString().split('T')[0]}.xlsx`);
};
