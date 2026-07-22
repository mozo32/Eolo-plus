import React, {
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    Download,
    FileSpreadsheet,
    LoaderCircle,
    X,
} from "lucide-react";
import type { PernoctaExcelRegistro } from "@/stores/apiPernoctaMes";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    registros: PernoctaExcelRegistro[];
    periodo: string;
    cargando: boolean;
    descargando: boolean;
}

type AeronavePreview = {
    matricula: string;
    aeronave: string;
    estatus: string;
    categoria: string;
    ubicacion: string;
    dias: Set<number>;
    total: number;
};

type MesPreview = {
    clave: string;
    anio: number;
    mes: number;
    nombre: string;
    diasDelMes: number;
    aeronaves: AeronavePreview[];
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
    const [anio, mes, dia] = fecha
        .substring(0, 10)
        .split("-")
        .map(Number);

    return {
        anio,
        mes,
        dia,
    };
};

const obtenerValoresUnicos = (
    valores: Array<string | null | undefined>,
    valorPredeterminado: string,
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

    return unicos.length
        ? unicos.join(" / ")
        : valorPredeterminado;
};

const construirVistaPrevia = (
    registros: PernoctaExcelRegistro[],
): MesPreview[] => {
    const registrosPorMes = new Map<
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

        const actuales =
            registrosPorMes.get(clave) ?? [];

        actuales.push(registro);
        registrosPorMes.set(clave, actuales);
    });

    return Array.from(registrosPorMes.entries())
        .sort(([claveA], [claveB]) =>
            claveA.localeCompare(claveB),
        )
        .map(([clave, registrosMes]) => {
            const [anioTexto, mesTexto] =
                clave.split("-");

            const anio = Number(anioTexto);
            const mes = Number(mesTexto);
            const diasDelMes = new Date(
                anio,
                mes,
                0,
            ).getDate();

            const registrosPorMatricula = new Map<
                string,
                PernoctaExcelRegistro[]
            >();

            registrosMes.forEach((registro) => {
                const matricula =
                    registro.matricula
                        ?.trim()
                        .toUpperCase() ||
                    "SIN MATRÍCULA";

                const actuales =
                    registrosPorMatricula.get(
                        matricula,
                    ) ?? [];

                actuales.push(registro);

                registrosPorMatricula.set(
                    matricula,
                    actuales,
                );
            });

            const aeronaves = Array.from(
                registrosPorMatricula.entries(),
            )
                .map(
                    ([
                        matricula,
                        registrosMatricula,
                    ]): AeronavePreview => {
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
                            aeronave:
                                obtenerValoresUnicos(
                                    registrosMatricula.map(
                                        (registro) =>
                                            registro.aeronave,
                                    ),
                                    "SIN DATO",
                                ),
                            estatus:
                                obtenerValoresUnicos(
                                    registrosMatricula.map(
                                        (registro) =>
                                            registro.estatus,
                                    ),
                                    "SIN DATO",
                                ),
                            categoria:
                                obtenerValoresUnicos(
                                    registrosMatricula.map(
                                        (registro) =>
                                            registro.categoria,
                                    ),
                                    "SIN DATO",
                                ),
                            ubicacion:
                                obtenerValoresUnicos(
                                    registrosMatricula.map(
                                        (registro) =>
                                            registro.ubicacion,
                                    ),
                                    "SIN DATO",
                                ),
                            dias,
                            total: dias.size,
                        };
                    },
                )
                .sort((a, b) => {
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

            return {
                clave,
                anio,
                mes,
                nombre: `${MESES[mes - 1]} ${anio}`,
                diasDelMes,
                aeronaves,
            };
        });
};

export default function ModalVistaPreviaExcelPernocta({
    isOpen,
    onClose,
    onConfirm,
    registros,
    periodo,
    cargando,
    descargando,
}: Props) {
    const [mesActivo, setMesActivo] =
        useState(0);

    const meses = useMemo(
        () => construirVistaPrevia(registros),
        [registros],
    );

    useEffect(() => {
        if (isOpen) {
            setMesActivo(0);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const mesSeleccionado =
        meses[mesActivo] ?? null;

    const cerrarModal = () => {
        if (cargando || descargando) return;

        onClose();
    };

    return (
        <div className="fixed inset-0 z-[190] flex items-center justify-center p-3 sm:p-5">
            <div
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                onClick={cerrarModal}
            />

            <div className="relative z-10 flex h-[92vh] w-full max-w-[96vw] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                            <FileSpreadsheet size={20} />
                        </div>

                        <div className="min-w-0">
                            <h3 className="text-sm font-black uppercase text-slate-800">
                                Vista previa del Excel
                            </h3>

                            <p className="truncate text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                {periodo}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={cerrarModal}
                        disabled={
                            cargando || descargando
                        }
                        className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 disabled:opacity-40"
                        title="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                {meses.length > 1 && !cargando && (
                    <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                        {meses.map((mes, index) => (
                            <button
                                key={mes.clave}
                                type="button"
                                onClick={() =>
                                    setMesActivo(index)
                                }
                                className={`shrink-0 rounded-lg border px-4 py-2 text-[10px] font-black uppercase transition-colors ${
                                    mesActivo === index
                                        ? "border-emerald-600 bg-emerald-600 text-white"
                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                }`}
                            >
                                {mes.nombre}
                            </button>
                        ))}
                    </div>
                )}

                <div className="min-h-0 flex-1 bg-slate-200 p-2 sm:p-4">
                    {cargando ? (
                        <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl bg-white">
                            <LoaderCircle
                                size={32}
                                className="animate-spin text-emerald-600"
                            />

                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                Preparando vista previa
                            </p>
                        </div>
                    ) : !mesSeleccionado ? (
                        <div className="flex h-full items-center justify-center rounded-xl bg-white">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                No hay registros disponibles
                            </p>
                        </div>
                    ) : (
                        <div className="h-full overflow-auto rounded-xl border border-slate-300 bg-white shadow-sm">
                            <div className="min-w-max">
                                <div className="sticky top-0 z-30 border-b border-emerald-700 bg-white px-3 py-3">
                                    <h4 className="text-sm font-black uppercase text-slate-800">
                                        {mesSeleccionado.nombre}
                                    </h4>
                                </div>

                                <table className="border-collapse text-left">
                                    <thead className="sticky top-[45px] z-20">
                                        <tr>
                                            <th className="min-w-[130px] border border-slate-600 bg-black px-2 py-2 text-[10px] font-black uppercase text-white">
                                                Matrícula
                                            </th>

                                            <th className="min-w-[120px] border border-slate-600 bg-black px-2 py-2 text-[10px] font-black uppercase text-white">
                                                Aeronave
                                            </th>

                                            <th className="min-w-[120px] border border-slate-600 bg-black px-2 py-2 text-[10px] font-black uppercase text-white">
                                                Estatus
                                            </th>

                                            <th className="min-w-[110px] border border-slate-600 bg-black px-2 py-2 text-[10px] font-black uppercase text-white">
                                                Categoría
                                            </th>

                                            <th className="min-w-[90px] border border-slate-600 bg-black px-2 py-2 text-[10px] font-black uppercase text-white">
                                                Ubicación
                                            </th>

                                            {Array.from(
                                                {
                                                    length:
                                                        mesSeleccionado.diasDelMes,
                                                },
                                                (_, index) =>
                                                    index + 1,
                                            ).map((dia) => (
                                                <th
                                                    key={
                                                        dia
                                                    }
                                                    className="min-w-[40px] border border-slate-600 bg-black px-2 py-2 text-center text-[10px] font-black text-white"
                                                >
                                                    {
                                                        dia
                                                    }
                                                </th>
                                            ))}

                                            <th className="min-w-[60px] border border-slate-600 bg-black px-2 py-2 text-center text-[10px] font-black uppercase text-white">
                                                Total
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {mesSeleccionado.aeronaves.map(
                                            (
                                                aeronave,
                                            ) => (
                                                <tr
                                                    key={`${mesSeleccionado.clave}-${aeronave.matricula}`}
                                                >
                                                    <td className="border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-black uppercase text-slate-800">
                                                        {
                                                            aeronave.matricula
                                                        }
                                                    </td>

                                                    <td className="border border-slate-300 bg-white px-2 py-1.5 text-[10px] uppercase text-slate-700">
                                                        {
                                                            aeronave.aeronave
                                                        }
                                                    </td>

                                                    <td className="border border-slate-300 bg-white px-2 py-1.5 text-[10px] uppercase text-slate-700">
                                                        {
                                                            aeronave.estatus
                                                        }
                                                    </td>

                                                    <td className="border border-slate-300 bg-white px-2 py-1.5 text-[10px] uppercase text-slate-700">
                                                        {
                                                            aeronave.categoria
                                                        }
                                                    </td>

                                                    <td className="border border-slate-300 bg-white px-2 py-1.5 text-[10px] font-bold uppercase text-slate-700">
                                                        {
                                                            aeronave.ubicacion
                                                        }
                                                    </td>

                                                    {Array.from(
                                                        {
                                                            length:
                                                                mesSeleccionado.diasDelMes,
                                                        },
                                                        (
                                                            _,
                                                            index,
                                                        ) =>
                                                            index +
                                                            1,
                                                    ).map(
                                                        (
                                                            dia,
                                                        ) => {
                                                            const estuvo =
                                                                aeronave.dias.has(
                                                                    dia,
                                                                );

                                                            return (
                                                                <td
                                                                    key={
                                                                        dia
                                                                    }
                                                                    className={`border border-slate-400 px-2 py-1.5 text-center text-[10px] font-bold text-black ${
                                                                        estuvo
                                                                            ? "bg-[#c6e0b4]"
                                                                            : "bg-[#bdd7ee]"
                                                                    }`}
                                                                >
                                                                    {estuvo
                                                                        ? 1
                                                                        : 0}
                                                                </td>
                                                            );
                                                        },
                                                    )}

                                                    <td className="border border-amber-500 bg-[#ffd966] px-2 py-1.5 text-center text-[10px] font-black text-black">
                                                        {
                                                            aeronave.total
                                                        }
                                                    </td>
                                                </tr>
                                            ),
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            {registros.length} registros
                            encontrados
                        </p>

                        {mesSeleccionado && (
                            <p className="mt-0.5 text-[9px] font-bold uppercase text-slate-500">
                                {
                                    mesSeleccionado
                                        .aeronaves.length
                                }{" "}
                                aeronaves en{" "}
                                {mesSeleccionado.nombre}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <button
                            type="button"
                            onClick={cerrarModal}
                            disabled={
                                cargando || descargando
                            }
                            className="rounded border border-slate-200 bg-white px-5 py-2.5 text-[10px] font-black uppercase text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                void onConfirm()
                            }
                            disabled={
                                cargando ||
                                descargando ||
                                !registros.length
                            }
                            className="flex items-center justify-center gap-2 rounded bg-emerald-600 px-5 py-2.5 text-[10px] font-black uppercase text-white shadow-md shadow-emerald-100 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            {descargando ? (
                                <>
                                    <LoaderCircle
                                        size={14}
                                        className="animate-spin"
                                    />
                                    Generando Excel
                                </>
                            ) : (
                                <>
                                    <Download size={14} />
                                    Confirmar y descargar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
