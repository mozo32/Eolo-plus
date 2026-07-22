import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export type PernoctaExcelRegistro = {
    id?: number;
    fecha: string;
    hora?: string;
    matricula: string;
    aeronave?: string | null;
    estatus?: string | null;
    ubicacion?: string | null;
    categoria?: string | null;
    nombre?: string | null;
    observaciones?: string | null;
};

type AeronaveAgrupada = {
    matricula: string;
    aeronave: string;
    estatus: string;
    categoria: string;
    ubicacion: string;
    dias: Set<number>;
};

const MESES = [
    "ENERO",
    "FEBRERO",
    "MARZO",
    "ABRIL",
    "MAYO",
    "JUNIO",
    "JULIO",
    "AGOSTO",
    "SEPTIEMBRE",
    "OCTUBRE",
    "NOVIEMBRE",
    "DICIEMBRE",
];

const obtenerPartesFecha = (fecha: string) => {
    const fechaLimpia = fecha.substring(0, 10);
    const [anio, mes, dia] = fechaLimpia.split("-").map(Number);

    return {
        anio,
        mes,
        dia,
    };
};

const obtenerDiasDelMes = (
    anio: number,
    mes: number,
) => {
    return new Date(anio, mes, 0).getDate();
};

const numeroAColumnaExcel = (numero: number) => {
    let columna = "";
    let valor = numero;

    while (valor > 0) {
        const residuo = (valor - 1) % 26;

        columna =
            String.fromCharCode(65 + residuo) +
            columna;

        valor = Math.floor((valor - 1) / 26);
    }

    return columna;
};

const limpiarNombreHoja = (nombre: string) => {
    return nombre
        .replace(/[\\/*?:[\]]/g, "")
        .substring(0, 31);
};

const limpiarNombreArchivo = (texto: string) => {
    return texto
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();
};

const obtenerValoresUnicos = (
    valores: Array<string | null | undefined>,
    valorDefault: string,
) => {
    const unicos = Array.from(
        new Set(
            valores
                .map((valor) => valor?.trim())
                .filter(
                    (valor): valor is string =>
                        Boolean(valor),
                ),
        ),
    );

    return unicos.length > 0
        ? unicos.join(" / ")
        : valorDefault;
};

const agruparRegistrosPorMes = (
    registros: PernoctaExcelRegistro[],
) => {
    const meses = new Map<
        string,
        PernoctaExcelRegistro[]
    >();

    registros.forEach((registro) => {
        const { anio, mes } = obtenerPartesFecha(
            registro.fecha,
        );

        if (!anio || !mes) return;

        const clave = `${anio}-${String(mes).padStart(
            2,
            "0",
        )}`;

        const registrosMes = meses.get(clave) ?? [];

        registrosMes.push(registro);
        meses.set(clave, registrosMes);
    });

    return Array.from(meses.entries()).sort(
        ([claveA], [claveB]) =>
            claveA.localeCompare(claveB),
    );
};

const agruparAeronaves = (
    registros: PernoctaExcelRegistro[],
) => {
    const matriculas = new Map<
        string,
        PernoctaExcelRegistro[]
    >();

    registros.forEach((registro) => {
        const matricula =
            registro.matricula
                ?.trim()
                .toUpperCase() || "SIN MATRÍCULA";

        const registrosMatricula =
            matriculas.get(matricula) ?? [];

        registrosMatricula.push(registro);
        matriculas.set(
            matricula,
            registrosMatricula,
        );
    });

    const aeronaves: AeronaveAgrupada[] =
        Array.from(matriculas.entries()).map(
            ([matricula, registrosMatricula]) => {
                const dias = new Set<number>();

                registrosMatricula.forEach(
                    (registro) => {
                        const { dia } =
                            obtenerPartesFecha(
                                registro.fecha,
                            );

                        if (dia) {
                            dias.add(dia);
                        }
                    },
                );

                return {
                    matricula,
                    aeronave: obtenerValoresUnicos(
                        registrosMatricula.map(
                            (registro) =>
                                registro.aeronave,
                        ),
                        "SIN DATO",
                    ),
                    estatus: obtenerValoresUnicos(
                        registrosMatricula.map(
                            (registro) =>
                                registro.estatus,
                        ),
                        "SIN DATO",
                    ),
                    categoria: obtenerValoresUnicos(
                        registrosMatricula.map(
                            (registro) =>
                                registro.categoria,
                        ),
                        "SIN DATO",
                    ),
                    ubicacion: obtenerValoresUnicos(
                        registrosMatricula.map(
                            (registro) =>
                                registro.ubicacion,
                        ),
                        "SIN DATO",
                    ),
                    dias,
                };
            },
        );

    return aeronaves.sort((a, b) => {
        const ubicacion =
            a.ubicacion.localeCompare(
                b.ubicacion,
                "es",
                {
                    numeric: true,
                },
            );

        if (ubicacion !== 0) {
            return ubicacion;
        }

        return a.matricula.localeCompare(
            b.matricula,
            "es",
            {
                numeric: true,
            },
        );
    });
};

const aplicarBorde = (
    cell: ExcelJS.Cell,
    color = "FFD1D5DB",
) => {
    cell.border = {
        top: {
            style: "thin",
            color: {
                argb: color,
            },
        },
        left: {
            style: "thin",
            color: {
                argb: color,
            },
        },
        bottom: {
            style: "thin",
            color: {
                argb: color,
            },
        },
        right: {
            style: "thin",
            color: {
                argb: color,
            },
        },
    };
};

const crearHojaMes = (
    workbook: ExcelJS.Workbook,
    claveMes: string,
    registros: PernoctaExcelRegistro[],
) => {
    const [anioTexto, mesTexto] =
        claveMes.split("-");

    const anio = Number(anioTexto);
    const mes = Number(mesTexto);
    const diasDelMes = obtenerDiasDelMes(
        anio,
        mes,
    );

    const nombreMes = MESES[mes - 1];
    const titulo = `${nombreMes} ${anio}`;

    const nombreHoja = limpiarNombreHoja(
        `${nombreMes.substring(0, 3)}-${anio}`,
    );

    const worksheet = workbook.addWorksheet(
        nombreHoja,
        {
            views: [
                {
                    state: "frozen",
                    xSplit: 5,
                    ySplit: 3,
                    topLeftCell: "F4",
                    activeCell: "F4",
                },
            ],
            pageSetup: {
                orientation: "landscape",
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                paperSize: 9,
                margins: {
                    left: 0.2,
                    right: 0.2,
                    top: 0.4,
                    bottom: 0.4,
                    header: 0.2,
                    footer: 0.2,
                },
            },
        },
    );

    worksheet.properties.defaultRowHeight = 18;

    const columnaPrimerDia = 6;
    const columnaUltimoDia =
        columnaPrimerDia + diasDelMes - 1;
    const columnaTotal =
        columnaUltimoDia + 1;

    worksheet.mergeCells(
        1,
        1,
        1,
        columnaTotal,
    );

    const celdaTitulo = worksheet.getCell(
        1,
        1,
    );

    celdaTitulo.value = titulo;
    celdaTitulo.font = {
        name: "Arial",
        size: 14,
        bold: true,
        color: {
            argb: "FF111827",
        },
    };
    celdaTitulo.alignment = {
        horizontal: "left",
        vertical: "middle",
    };
    celdaTitulo.border = {
        bottom: {
            style: "medium",
            color: {
                argb: "FF15803D",
            },
        },
    };

    worksheet.getRow(1).height = 28;
    worksheet.getRow(2).height = 6;

    const encabezados = [
        "MATRÍCULA",
        "AERONAVE",
        "ESTATUS",
        "CATEGORÍA",
        "UBICACIÓN",
    ];

    for (let dia = 1; dia <= diasDelMes; dia++) {
        encabezados.push(String(dia));
    }

    encabezados.push("TOTAL");

    const filaEncabezados = worksheet.getRow(3);

    encabezados.forEach(
        (encabezado, index) => {
            const cell =
                filaEncabezados.getCell(index + 1);

            cell.value = encabezado;
            cell.font = {
                name: "Arial",
                size: 9,
                bold: true,
                color: {
                    argb: "FFFFFFFF",
                },
            };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                    argb: "FF000000",
                },
            };
            cell.alignment = {
                horizontal: "center",
                vertical: "middle",
                wrapText: true,
            };

            aplicarBorde(cell, "FF111827");
        },
    );

    filaEncabezados.height = 24;

    worksheet.getColumn(1).width = 16;
    worksheet.getColumn(2).width = 15;
    worksheet.getColumn(3).width = 16;
    worksheet.getColumn(4).width = 14;
    worksheet.getColumn(5).width = 13;

    for (
        let columna = columnaPrimerDia;
        columna <= columnaUltimoDia;
        columna++
    ) {
        worksheet.getColumn(columna).width = 4.5;
    }

    worksheet.getColumn(columnaTotal).width = 8;

    const aeronaves =
        agruparAeronaves(registros);

    aeronaves.forEach(
        (aeronave, indexAeronave) => {
            const numeroFila =
                indexAeronave + 4;

            const fila =
                worksheet.getRow(numeroFila);

            fila.height = 21;

            const datosPrincipales = [
                aeronave.matricula,
                aeronave.aeronave,
                aeronave.estatus,
                aeronave.categoria,
                aeronave.ubicacion,
            ];

            datosPrincipales.forEach(
                (valor, index) => {
                    const cell =
                        fila.getCell(index + 1);

                    cell.value = valor;
                    cell.font = {
                        name: "Arial",
                        size: 9,
                        bold: index === 0,
                        color: {
                            argb: "FF111827",
                        },
                    };
                    cell.alignment = {
                        horizontal: "left",
                        vertical: "middle",
                        wrapText: true,
                    };
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: {
                            argb: "FFFFFFFF",
                        },
                    };

                    aplicarBorde(cell);
                },
            );

            for (
                let dia = 1;
                dia <= diasDelMes;
                dia++
            ) {
                const columna =
                    columnaPrimerDia + dia - 1;

                const cell =
                    fila.getCell(columna);

                const estuvo =
                    aeronave.dias.has(dia);

                cell.value = estuvo ? 1 : 0;

                cell.font = {
                    name: "Arial",
                    size: 9,
                    color: {
                        argb: "FF000000",
                    },
                };

                cell.alignment = {
                    horizontal: "center",
                    vertical: "middle",
                };

                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: {
                        argb: estuvo
                            ? "FFC6E0B4"
                            : "FFBDD7EE",
                    },
                };

                aplicarBorde(cell, "FF64748B");
            }

            const celdaTotal =
                fila.getCell(columnaTotal);

            const columnaInicioLetra =
                numeroAColumnaExcel(
                    columnaPrimerDia,
                );

            const columnaFinLetra =
                numeroAColumnaExcel(
                    columnaUltimoDia,
                );

            const total =
                aeronave.dias.size;

            celdaTotal.value = {
                formula: `SUM(${columnaInicioLetra}${numeroFila}:${columnaFinLetra}${numeroFila})`,
                result: total,
            };

            celdaTotal.font = {
                name: "Arial",
                size: 10,
                bold: true,
                color: {
                    argb: "FF000000",
                },
            };

            celdaTotal.alignment = {
                horizontal: "center",
                vertical: "middle",
            };

            celdaTotal.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: {
                    argb: "FFFFD966",
                },
            };

            aplicarBorde(
                celdaTotal,
                "FFB45309",
            );
        },
    );

    worksheet.autoFilter = {
        from: {
            row: 3,
            column: 1,
        },
        to: {
            row: 3,
            column: columnaTotal,
        },
    };

    const ultimaFila =
        aeronaves.length + 3;

    worksheet.pageSetup.printArea =
        `A1:${numeroAColumnaExcel(
            columnaTotal,
        )}${ultimaFila}`;

    worksheet.pageSetup.printTitlesRow =
        "1:3";

    worksheet.headerFooter.oddFooter =
        "&LEolo Plus&CReporte de Pernoctas&RPágina &P de &N";
};

export async function ExcelPernoctaDia(
    registros: PernoctaExcelRegistro[],
    periodo: string,
) {
    if (!registros.length) {
        throw new Error(
            "No hay registros para generar el Excel.",
        );
    }

    const workbook =
        new ExcelJS.Workbook();

    workbook.creator = "Eolo Plus";
    workbook.company = "Eolo Plus";
    workbook.created = new Date();
    workbook.modified = new Date();

    workbook.calcProperties.fullCalcOnLoad =
        true;

    const registrosPorMes =
        agruparRegistrosPorMes(registros);

    registrosPorMes.forEach(
        ([claveMes, registrosMes]) => {
            crearHojaMes(
                workbook,
                claveMes,
                registrosMes,
            );
        },
    );

    const buffer =
        await workbook.xlsx.writeBuffer();

    const nombrePeriodo =
        limpiarNombreArchivo(
            periodo || "pernoctas",
        );

    saveAs(
        new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `pernoctas_${nombrePeriodo}.xlsx`,
    );
}
