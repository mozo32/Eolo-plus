import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export const exportarOperacionesAExcel = async (
    registros: any[],
    filtros: any = {}
) => {

    const workbook = new ExcelJS.Workbook();

    const worksheet = workbook.addWorksheet('Reporte de Operaciones');

    worksheet.mergeCells('A1:L1');

    const mainTitle = worksheet.getCell('A1');

    mainTitle.value = 'REPORTE DETALLADO DE OPERACIONES DIARIAS';

    mainTitle.font = {
        name: 'Arial Black',
        size: 16,
        color: { argb: 'FF0369A1' }
    };

    mainTitle.alignment = {
        horizontal: 'center',
        vertical: 'middle'
    };

    worksheet.getRow(1).height = 35;

    const fechaGeneracion = new Date().toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    worksheet.mergeCells('A2:L2');

    const fechaCell = worksheet.getCell('A2');

    fechaCell.value = `Fecha Reporte: ${fechaGeneracion}`;

    fechaCell.font = {
        size: 10,
        color: { argb: 'FF374151' }
    };

    fechaCell.alignment = {
        horizontal: 'left',
        vertical: 'middle'
    };

    worksheet.getRow(2).height = 20;

    worksheet.mergeCells('A3:L3');

    const filterCell = worksheet.getCell('A3');

    filterCell.font = {
        italic: true,
        size: 10,
        color: { argb: 'FF64748B' }
    };

    filterCell.alignment = {
        horizontal: 'left'
    };

    worksheet.getRow(3).height = 20;

    worksheet.mergeCells('K4:L4');

    const csaeGroupCell = worksheet.getCell('K4');

    csaeGroupCell.value = 'CSAE';

    csaeGroupCell.font = {
        bold: true,
        color: { argb: 'FF5B3F8C' },
        size: 11
    };

    csaeGroupCell.alignment = {
        horizontal: 'center',
        vertical: 'middle'
    };

    csaeGroupCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE9E5F3' }
    };

    csaeGroupCell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
    };

    const startRow = 5;

    const headers = [
        'ID',
        'TIPO',
        'MATRÍCULA',
        'EQUIPO',
        'FECHA-HORA',
        'ORIGEN/DESTINO',
        'TIPO DE OPERACIÓN',
        'PAX',
        'EQP',
        'TIPO DE CLIENTE',
        'MANTENIMIENTO CSAE',
        'FECHA-HORA CSAE'
    ];

    const headerRow = worksheet.getRow(startRow);

    headerRow.values = headers;

    headerRow.height = 30;

    headerRow.eachCell((cell) => {

        if (Number(cell.col) >= 11 && Number(cell.col) <= 12) {

            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE9E5F3' }
            };

            cell.font = {
                color: { argb: 'FF5B3F8C' },
                bold: true,
                size: 11
            };

        } else {

            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF003E51' }
            };

            cell.font = {
                color: { argb: 'FFFFFFFF' },
                bold: true,
                size: 11
            };

        }

        cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true
        };

        cell.border = {
            top: { style: 'thin', color: { argb: 'FF00556F' } },
            left: { style: 'thin', color: { argb: 'FF00556F' } },
            bottom: { style: 'thin', color: { argb: 'FF00556F' } },
            right: { style: 'thin', color: { argb: 'FF00556F' } }
        };

    });

    const columnWidths = [
        8,
        15,
        18,
        18,
        28,
        25,
        25,
        10,
        10,
        22,
        20,
        28
    ];

    columnWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
    });

    registros.forEach((op) => {

        const rowData = [
            op.id,
            op.tipo?.toUpperCase() || '',
            op.matricula || '',
            op.equipo || '',
            op.fecha_hora || '',
            op.lugar || '',
            op.tipo_operacion || '',
            op.pax || 0,
            op.equipaje || 0,
            op.tipo_cliente || '',
            op.mantenimiento_csae ? 'SI' : 'NO',
            op.fecha_hora_csae || ''
        ];

        const row = worksheet.addRow(rowData);

        row.eachCell((cell, colNumber) => {

            if (colNumber === 11 || colNumber === 12) {

                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF3F0FA' }
                };

            } else if (colNumber === 2) {

                const esLlegada =
                    op.tipo?.toLowerCase() === 'llegada';

                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: {
                        argb: esLlegada ? 'DCFCE7' : 'FEE2E2'
                    }
                };

                cell.font = {
                    color: {
                        argb: esLlegada ? '166534' : '991B1B'
                    },
                    bold: true
                };

            } else {

                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFFFFFF' }
                };

            }

            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true
            };

        });

    });

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const fechaHoy = new Date().toLocaleDateString('en-CA');

    saveAs(blob, `Reporte_Operaciones_${fechaHoy}.xlsx`);
};
