import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const ExcelRemisiones = async (datos: any[]) => {
    const workbook = new ExcelJS.Workbook();

    const sheetVentas = workbook.addWorksheet('Ventas ASA');
    const sheetCompras = workbook.addWorksheet('Compras ASA');

    sheetVentas.columns = [
        { header: 'FOLIO', key: 'folio', width: 15 },
        { header: 'FECHA', key: 'fecha', width: 15 },
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
        { header: 'FECHA', key: 'fecha', width: 15 },
        { header: 'LITROS', key: 'litros', width: 15 },
        { header: 'FACTURA', key: 'factura', width: 15 },
        { header: 'PRECIO DE COMPRA POR LT', key: 'precio_venta', width: 25 },
        { header: 'COSTO ASA', key: 'importe', width: 20 },
    ];

    const formatHeader = (ws: ExcelJS.Worksheet) => {
        const headerRow = ws.getRow(1);
        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '003E51' } };
            cell.font = { color: { argb: 'FFFFFF' }, bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
    };

    formatHeader(sheetVentas);
    formatHeader(sheetCompras);

    const formatearAObjetoFecha = (stringFecha: string) => {
        if (!stringFecha) return null;
        const [anio, mes, dia] = stringFecha.split('-').map(Number);
        return new Date(anio, mes - 1, dia);
    };

    datos.forEach((item) => {
        if (item.tipo === 'R') {
            sheetVentas.addRow({
                folio: item.folio,
                fecha: formatearAObjetoFecha(item.fecha),
                matricula: item.matricula,
                litros: Number(item.litros || 0),
                vta: item.vta,
                factura: item.factura,
                precio_venta: Number(item.precio_venta || 0),
                importe: Number(item.importe || 0),
                cliente: item.cliente,
                forma_pago: item.forma_pago,
                mes: item.mes,
                status: item.status === 'A' ? 'Activo' : item.status
            });
        } else {
            sheetCompras.addRow({
                folio: item.folio,
                fecha: formatearAObjetoFecha(item.fecha),
                litros: Number(item.litros || 0),
                factura: item.factura,
                precio_venta: Number(item.precio_venta || 0),
                importe: Number(item.importe || 0)
            });
        }
    });

    sheetVentas.getColumn('fecha').numFmt = 'dd/mm/yyyy';
    sheetVentas.getColumn('litros').numFmt = '#,##0.00';
    sheetVentas.getColumn('precio_venta').numFmt = '$#,##0.0000';
    sheetVentas.getColumn('importe').numFmt = '$#,##0.0000';
    sheetVentas.getColumn('fecha').alignment = { horizontal: 'center' };
    sheetCompras.getColumn('fecha').numFmt = 'dd/mm/yyyy';
    sheetCompras.getColumn('litros').numFmt = '#,##0.00';
    sheetCompras.getColumn('precio_venta').numFmt = '$#,##0.0000';
    sheetCompras.getColumn('importe').numFmt = '$#,##0.0000';
    sheetCompras.getColumn('fecha').alignment = { horizontal: 'center' };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Reporte_ASA_${new Date().toISOString().split('T')[0]}.xlsx`);
};
