import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const NOMBRES_DRENES: Record<number, string> = {
    1: "Delantero del tanque",
    2: "Strainer",
    3: "Succión auxiliar",
    4: "Trasero del tanque",
    5: "Entrada a elementos filtrantes",
    6: "Salida de elementos filtrantes"
};

const parsearFechaSegura = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date && !isNaN(value.getTime())) {
        return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes(), 0));
    }

    const texto = String(value).trim();
    const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::\d{2})?)?/);

    if (match) {
        const [, anio, mes, dia, hora = '00', minuto = '00'] = match;
        return new Date(Date.UTC(Number(anio), Number(mes) - 1, Number(dia), Number(hora), Number(minuto), 0));
    }

    const fecha = new Date(texto);
    if (isNaN(fecha.getTime())) return null;

    return new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), fecha.getHours(), fecha.getMinutes(), 0));
};

const obtenerMes = (fecha: string) => {
    const d = parsearFechaSegura(fecha);
    return d ? MESES[d.getUTCMonth()] : '';
};

const estiloTitulo = (cell: ExcelJS.Cell) => {
    cell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
};

const estiloHeader = (cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
    cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
};

const estiloFila = (cell: ExcelJS.Cell) => {
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
    };
};

const aplicarFormatoFecha = (cell: ExcelJS.Cell) => {
    if (cell.value instanceof Date) {
        cell.numFmt = 'dd/mm/yyyy hh:mm';
    }
};

const combinarCeldasPorId = (
    worksheet: ExcelJS.Worksheet,
    filaInicio: number,
    filaFin: number,
    columnasACombinar: number[] = [1, 2, 3],
) => {
    let inicioGrupo = 0;
    let idActual: any = null;

    const esFilaDeDatos = (fila: number) => {
        const valorId = worksheet.getCell(fila, 1).value;
        return valorId !== null && valorId !== undefined && valorId !== "" && !isNaN(Number(valorId));
    };

    const cerrarGrupo = (finGrupo: number) => {
        if (inicioGrupo > 0 && inicioGrupo < finGrupo) {
            columnasACombinar.forEach((columna) => {
                worksheet.mergeCells(inicioGrupo, columna, finGrupo, columna);
                const celda = worksheet.getCell(inicioGrupo, columna);
                celda.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
                celda.border = {
                    top: { style: "thin", color: { argb: "FFE5E7EB" } },
                    left: { style: "thin", color: { argb: "FFE5E7EB" } },
                    bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
                    right: { style: "thin", color: { argb: "FFE5E7EB" } },
                };
            });
        }
    };

    for (let fila = filaInicio; fila <= filaFin + 1; fila++) {
        if (fila > filaFin || !esFilaDeDatos(fila)) {
            cerrarGrupo(fila - 1);
            inicioGrupo = 0;
            idActual = null;
            continue;
        }

        const idFila = worksheet.getCell(fila, 1).value;

        if (inicioGrupo === 0) {
            inicioGrupo = fila;
            idActual = idFila;
            continue;
        }

        if (idFila !== idActual) {
            cerrarGrupo(fila - 1);
            inicioGrupo = fila;
            idActual = idFila;
        }
    }
};

export const exportarInspeccionesExcel = async (registros: any[]) => {
    const workbook = new ExcelJS.Workbook();

    const combustible = registros.filter(r => r.tipo === 'COMBUSTIBLE');
    const autotanque = registros.filter(r => r.tipo === 'AUTOTANQUE');

    const wsC = workbook.addWorksheet('Combustible');

    wsC.mergeCells('A1:E1');
    const titleC = wsC.getCell('A1');
    titleC.value = 'REPORTE DE INSPECCIONES DE COMBUSTIBLE';
    estiloTitulo(titleC);

    wsC.mergeCells('A2:E2');
    wsC.getCell('A2').value = `Generado: ${new Date().toLocaleString('es-MX', { hour12: false })}`;

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
            const fechaObjeto = parsearFechaSegura(item.fecha) || '';

            item.imagenes?.forEach((img: any) => {
                const row = wsC.addRow([
                    item.id,
                    mes,
                    fechaObjeto,
                    img.pivot?.tag || '',
                    img.pivot?.observacion || ''
                ]);

                row.eachCell(estiloFila);
                aplicarFormatoFecha(row.getCell(3));
            });
        });
    });

    combinarCeldasPorId(wsC, 4, wsC.lastRow?.number ?? 4, [1, 2, 3]);

    wsC.columns = [
        { width: 10 },
        { width: 15 },
        { width: 25 },
        { width: 30 },
        { width: 30 }
    ];

    const wsA = workbook.addWorksheet('Autotanque');

    wsA.mergeCells('A1:G1');
    const titleA = wsA.getCell('A1');
    titleA.value = 'REPORTE DE INSPECCIONES AUTOTANQUE';
    estiloTitulo(titleA);

    wsA.mergeCells('A2:G2');
    wsA.getCell('A2').value = `Generado: ${new Date().toLocaleString('es-MX', { hour12: false })}`;

    const headersA = ['ID', 'MES', 'FECHA', 'NOMBRE DEL DREN', 'TOMA MUESTRA', 'CLARIDAD', 'SÓLIDOS/AGUA'];
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
            const fechaObjeto = parsearFechaSegura(item.fecha) || '';

            for (let i = 1; i <= 6; i++) {
                const tomaMuestra = item[`toma_muestra_combustible_dren_${i}`] || '';
                const tomaEsNo = String(tomaMuestra).trim().toLowerCase() === 'no';

                const claridad = tomaEsNo
                    ? 'No se realizaron pruebas'
                    : item[`prueba_claridad_brillantez_dren_${i}`] || '';

                const solidosAgua = tomaEsNo
                    ? 'No se realizaron pruebas'
                    : item[`presencia_solidos_agua_dren_${i}`] || '';

                const nombreDren = NOMBRES_DRENES[i]
                    ? `Dren ${i}: ${NOMBRES_DRENES[i]}`
                    : `Dren ${i}`;

                const row = wsA.addRow([
                    item.id,
                    mes,
                    fechaObjeto,
                    nombreDren,
                    tomaMuestra,
                    claridad,
                    solidosAgua
                ]);

                row.eachCell(estiloFila);
                aplicarFormatoFecha(row.getCell(3));
            }
        });
    });

    combinarCeldasPorId(wsA, 4, wsA.lastRow?.number ?? 4, [1, 2, 3]);

    wsA.columns = [
        { width: 10 },
        { width: 15 },
        { width: 25 },
        { width: 30 },
        { width: 22 },
        { width: 28 },
        { width: 28 }
    ];

    wsC.autoFilter = {
        from: { row: 3, column: 1 },
        to: { row: 3, column: headersC.length }
    };

    wsA.autoFilter = {
        from: { row: 3, column: 1 },
        to: { row: 3, column: headersA.length }
    };

    wsC.views = [{ state: 'frozen', ySplit: 3 }];
    wsA.views = [{ state: 'frozen', ySplit: 3 }];

    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    saveAs(blob, `Inspecciones_${new Date().toISOString().split('T')[0]}.xlsx`);
};
