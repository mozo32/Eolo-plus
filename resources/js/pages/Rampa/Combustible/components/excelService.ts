import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const obtenerMes = (fecha: string) => {
    const d = new Date(fecha);
    return MESES[d.getMonth()];
};

const estiloTitulo = (cell: ExcelJS.Cell) => {
    cell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
};

const estiloHeader = (cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
    cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
};

const estiloFila = (cell: ExcelJS.Cell) => {
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
    };
};

export const exportarInspeccionesExcel = async (registros: any[]) => {

    const workbook = new ExcelJS.Workbook();

    const combustible = registros.filter(r => r.tipo === 'COMBUSTIBLE');
    const autotanque = registros.filter(r => r.tipo === 'AUTOTANQUE');

    /* =========================
       COMBUSTIBLE
    ========================= */
    const wsC = workbook.addWorksheet('Combustible');

    wsC.mergeCells('A1:E1');
    const titleC = wsC.getCell('A1');
    titleC.value = 'REPORTE DE INSPECCIONES DE COMBUSTIBLE';
    estiloTitulo(titleC);

    wsC.mergeCells('A2:E2');
    wsC.getCell('A2').value = `Generado: ${new Date().toLocaleString()}`;

    const headersC = ['ID', 'MES', 'FECHA', 'PRUEBA REALIZADA', 'RESULTADO'];
    const headerRowC = wsC.addRow(headersC);

    headerRowC.eachCell(estiloHeader);

    const groupedC: Record<string, any[]> = {};

    combustible.forEach(item => {
        const mes = obtenerMes(item.fecha);
        if (!groupedC[mes]) groupedC[mes] = [];
        groupedC[mes].push(item);
    });

    Object.keys(groupedC).forEach(mes => {

        const groupRow = wsC.addRow([`MES: ${mes}`]);
        groupRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FF1F4E79' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F1FA' } };
        });

        groupedC[mes].forEach(item => {
            item.imagenes?.forEach((img: any) => {

                const row = wsC.addRow([
                    item.id,
                    mes,
                    item.fecha,
                    img.pivot?.tag || '',
                    img.pivot?.observacion || ''
                ]);

                row.eachCell(estiloFila);
            });
        });
    });

    wsC.columns = [
        { width: 10 },
        { width: 15 },
        { width: 25 },
        { width: 30 },
        { width: 30 }
    ];

    /* =========================
       AUTOTANQUE
    ========================= */
    const wsA = workbook.addWorksheet('Autotanque');

    wsA.mergeCells('A1:F1');
    const titleA = wsA.getCell('A1');
    titleA.value = 'REPORTE DE INSPECCIONES AUTOTANQUE';
    estiloTitulo(titleA);

    wsA.mergeCells('A2:F2');
    wsA.getCell('A2').value = `Generado: ${new Date().toLocaleString()}`;

    const headersA = [
        'ID',
        'MES',
        'FECHA',
        'TOMA MUESTRA',
        'CLARIDAD',
        'SÓLIDOS / AGUA'
    ];

    const headerRowA = wsA.addRow(headersA);
    headerRowA.eachCell(estiloHeader);

    const groupedA: Record<string, any[]> = {};

    autotanque.forEach(item => {
        const mes = obtenerMes(item.fecha);
        if (!groupedA[mes]) groupedA[mes] = [];
        groupedA[mes].push(item);
    });

    Object.keys(groupedA).forEach(mes => {

        const groupRow = wsA.addRow([`MES: ${mes}`]);
        groupRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FF1F4E79' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F1FA' } };
        });

        groupedA[mes].forEach(item => {

            const row = wsA.addRow([
                item.id,
                mes,
                item.fecha,
                item.toma_muestra_combustible,
                item.prueba_claridad_brillantez,
                item.presencia_solidos_agua
            ]);

            row.eachCell(estiloFila);
        });
    });

    wsA.columns = [
        { width: 10 },
        { width: 15 },
        { width: 25 },
        { width: 25 },
        { width: 25 },
        { width: 25 }
    ];

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(blob, `Inspecciones_${new Date().toISOString().split('T')[0]}.xlsx`);
};
