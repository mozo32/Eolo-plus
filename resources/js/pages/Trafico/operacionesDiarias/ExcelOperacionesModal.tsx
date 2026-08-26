import React, { useCallback, useEffect, useState } from 'react';
import {
    ChevronDown,
    Download,
    FileSpreadsheet,
    Loader2,
    RefreshCw,
    X,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { excelOperacionesDiariasApi } from '@/stores/apiOperacionesDiarias';
import {
    COLUMNAS_REPORTE_OPERACIONES,
    ESTILOS_REPORTE_OPERACIONES,
    GRUPOS_REPORTE_OPERACIONES,
    exportarOperacionesAExcel,
    formatearFechaGeneracionReporte,
    formatearValorVistaPreviaReporte,
    prepararFilasReporteOperaciones,
} from './excelService';
import type {
    FilaReporteOperaciones,
    GrupoColumnaReporteOperaciones,
    Operacion,
} from './excelService';
import type { FiltrosReporte } from './ReporteRapidoOperacionesPdf';

interface ExcelOperacionesModalProps {
    open: boolean;
    onClose: () => void;
    filtros: FiltrosReporte;
}

type RegistroExcel = Operacion & Record<string, unknown>;

const normalizarOperacion = (registro: unknown): RegistroExcel | null => {
    if (
        typeof registro !== 'object' ||
        registro === null ||
        Array.isArray(registro)
    ) {
        return null;
    }

    const valores = registro as Record<string, unknown>;
    const id = Number(valores.id);

    if (!Number.isFinite(id)) {
        return null;
    }

    return {
        ...valores,
        id,
    } as RegistroExcel;
};

const extraerRegistros = (respuesta: unknown): RegistroExcel[] => {
    const contenido = Array.isArray(respuesta)
        ? respuesta
        : typeof respuesta === 'object' && respuesta !== null && 'data' in respuesta
            ? (respuesta as { data?: unknown }).data
            : [];

    if (!Array.isArray(contenido)) return [];

    return contenido
        .map(normalizarOperacion)
        .filter((registro): registro is RegistroExcel => registro !== null);
};

const obtenerEstiloGrupo = (grupo: GrupoColumnaReporteOperaciones) => {
    return ESTILOS_REPORTE_OPERACIONES[grupo];
};

const obtenerAnchoColumna = (anchoExcel: number) => {
    return Math.max(64, Math.round(anchoExcel * 7.2));
};

const obtenerOffsetColumnaFija = (indiceColumna: number): number | undefined => {
    if (indiceColumna > 2) return undefined;

    return COLUMNAS_REPORTE_OPERACIONES.slice(0, indiceColumna).reduce(
        (total, columna) => total + obtenerAnchoColumna(columna.ancho),
        0
    );
};

const ExcelOperacionesModal = ({
    open,
    onClose,
    filtros,
}: ExcelOperacionesModalProps) => {
    const [cargando, setCargando] = useState(false);
    const [descargando, setDescargando] = useState(false);
    const [error, setError] = useState('');
    const [datos, setDatos] = useState<RegistroExcel[]>([]);
    const [filasVistaPrevia, setFilasVistaPrevia] = useState<
        FilaReporteOperaciones[]
    >([]);
    const [fechaReporte, setFechaReporte] = useState<Date | null>(null);

    const cargarVistaPrevia = useCallback(async () => {
        setCargando(true);
        setError('');
        setDatos([]);
        setFilasVistaPrevia([]);
        setFechaReporte(null);

        try {
            const respuesta = await excelOperacionesDiariasApi({ ...filtros });
            const registros = extraerRegistros(respuesta);
            const filasReporte = prepararFilasReporteOperaciones(registros);

            if (registros.length === 0 || filasReporte.length === 0) {
                setError(
                    'No hay registros para exportar con los filtros seleccionados.'
                );
                return;
            }

            const nuevaFechaReporte = new Date();

            setDatos(registros);
            setFilasVistaPrevia(filasReporte);
            setFechaReporte(nuevaFechaReporte);
        } catch (error: any) {
            setError(
                error?.message ||
                'No fue posible preparar la vista previa del Excel.'
            );
        } finally {
            setCargando(false);
        }
    }, [filtros]);

    useEffect(() => {
        if (!open) {
            setDatos([]);
            setFilasVistaPrevia([]);
            setFechaReporte(null);
            setError('');
            setCargando(false);
            setDescargando(false);
            return;
        }

        void cargarVistaPrevia();
    }, [open, cargarVistaPrevia]);

    useEffect(() => {
        if (!open) return;

        const cerrarConEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !descargando) {
                onClose();
            }
        };

        document.addEventListener('keydown', cerrarConEscape);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', cerrarConEscape);
            document.body.style.overflow = '';
        };
    }, [open, onClose, descargando]);

    const descargarExcel = async () => {
        if (datos.length === 0 || !fechaReporte || descargando) return;

        setDescargando(true);

        try {
            await exportarOperacionesAExcel(datos, filtros, fechaReporte);

            await Swal.fire({
                icon: 'success',
                title: 'Excel generado',
                text: 'El reporte se descargó correctamente.',
                timer: 1800,
                showConfirmButton: false,
            });
        } catch (error: any) {
            await Swal.fire({
                icon: 'error',
                title: 'No fue posible descargar el Excel',
                text: error?.message || 'Inténtalo nuevamente.',
            });
        } finally {
            setDescargando(false);
        }
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-vista-previa-excel"
        >
            <div
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                onClick={() => !descargando && onClose()}
            />

            <div className="relative z-10 flex h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <FileSpreadsheet size={21} />
                        </div>

                        <div className="min-w-0">
                            <h2
                                id="titulo-vista-previa-excel"
                                className="truncate text-sm font-black uppercase tracking-wide text-slate-800"
                            >
                                Vista previa del reporte Excel
                            </h2>
                            <p className="truncate text-xs text-slate-500">
                                Operaciones diarias según los filtros seleccionados
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={descargando}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                        title="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 bg-slate-100 p-3 sm:p-4">
                    {cargando && (
                        <div className="flex h-full flex-col items-center justify-center rounded-xl border border-slate-200 bg-white">
                            <Loader2
                                size={36}
                                className="mb-3 animate-spin text-emerald-600"
                            />
                            <p className="text-sm font-black uppercase tracking-wide text-slate-700">
                                Generando vista previa
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                                Consultando los registros del reporte...
                            </p>
                        </div>
                    )}

                    {!cargando && error && (
                        <div className="flex h-full flex-col items-center justify-center rounded-xl border border-red-200 bg-white px-6 text-center">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                                <FileSpreadsheet size={29} />
                            </div>

                            <p className="text-sm font-black uppercase text-slate-800">
                                Sin vista previa
                            </p>
                            <p className="mt-2 max-w-md text-sm text-slate-500">
                                {error}
                            </p>

                            <button
                                type="button"
                                onClick={cargarVistaPrevia}
                                className="mt-5 flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white transition-colors hover:bg-slate-700"
                            >
                                <RefreshCw size={15} />
                                Reintentar
                            </button>
                        </div>
                    )}

                    {!cargando &&
                        !error &&
                        filasVistaPrevia.length > 0 &&
                        fechaReporte && (
                        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
                            <div className="flex flex-col gap-1 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs font-black uppercase tracking-wide text-slate-700">
                                    Filas del Excel: {filasVistaPrevia.length.toLocaleString()}
                                </p>
                                <p className="text-[11px] font-semibold text-slate-400">
                                    La vista previa y la descarga utilizan exactamente las mismas filas.
                                </p>
                            </div>

                            <div className="min-h-0 flex-1 overflow-auto">
                                <table
                                    className="min-w-max border-separate border-spacing-0 text-center"
                                    style={{ fontFamily: 'Arial, sans-serif' }}
                                >
                                    <colgroup>
                                        {COLUMNAS_REPORTE_OPERACIONES.map(
                                            (columna, indice) => (
                                                <col
                                                    key={`${columna.titulo}-${indice}`}
                                                    style={{
                                                        width: obtenerAnchoColumna(
                                                            columna.ancho
                                                        ),
                                                        minWidth: obtenerAnchoColumna(
                                                            columna.ancho
                                                        ),
                                                    }}
                                                />
                                            )
                                        )}
                                    </colgroup>

                                    <thead className="sticky top-0 z-20 bg-white">
                                        <tr>
                                            <th
                                                colSpan={COLUMNAS_REPORTE_OPERACIONES.length}
                                                className="h-[45px] bg-white px-4 text-center text-[21px] font-bold"
                                                style={{
                                                    color: ESTILOS_REPORTE_OPERACIONES.titulo,
                                                }}
                                            >
                                                REPORTE DETALLADO DE OPERACIONES DIARIAS
                                            </th>
                                        </tr>

                                        <tr>
                                            <th
                                                colSpan={COLUMNAS_REPORTE_OPERACIONES.length}
                                                className="h-[27px] bg-white px-3 text-left text-[13px] font-normal"
                                                style={{
                                                    color: ESTILOS_REPORTE_OPERACIONES.textoSecundario,
                                                }}
                                            >
                                                Fecha de reporte:{' '}
                                                {formatearFechaGeneracionReporte(
                                                    fechaReporte
                                                )}
                                            </th>
                                        </tr>

                                        <tr>
                                            <th
                                                colSpan={COLUMNAS_REPORTE_OPERACIONES.length}
                                                className="h-[11px] bg-white"
                                            />
                                        </tr>

                                        <tr>
                                            {GRUPOS_REPORTE_OPERACIONES.map(
                                                (grupo, indice) => {
                                                    const estilo = obtenerEstiloGrupo(
                                                        grupo.grupo
                                                    );
                                                    const vacio = grupo.titulo === '';

                                                    return (
                                                        <th
                                                            key={`${grupo.titulo}-${indice}`}
                                                            colSpan={grupo.columnas}
                                                            className="h-[32px] text-[14px] font-bold"
                                                            style={{
                                                                backgroundColor: vacio
                                                                    ? '#FFFFFF'
                                                                    : estilo.encabezado,
                                                                color: estilo.texto,
                                                                border: vacio
                                                                    ? undefined
                                                                    : `1px solid ${ESTILOS_REPORTE_OPERACIONES.borde}`,
                                                            }}
                                                        >
                                                            {grupo.titulo}
                                                        </th>
                                                    );
                                                }
                                            )}
                                        </tr>

                                        <tr>
                                            {COLUMNAS_REPORTE_OPERACIONES.map(
                                                (columna, indiceColumna) => {
                                                    const estilo = obtenerEstiloGrupo(
                                                        columna.grupo
                                                    );
                                                    const fija = indiceColumna <= 2;

                                                    return (
                                                        <th
                                                            key={`${columna.titulo}-${indiceColumna}`}
                                                            className="h-[56px] whitespace-normal px-2 py-2 text-[12px] font-bold leading-tight"
                                                            style={{
                                                                width: obtenerAnchoColumna(
                                                                    columna.ancho
                                                                ),
                                                                minWidth: obtenerAnchoColumna(
                                                                    columna.ancho
                                                                ),
                                                                backgroundColor:
                                                                    estilo.encabezado,
                                                                color: estilo.texto,
                                                                border: `1px solid ${ESTILOS_REPORTE_OPERACIONES.borde}`,
                                                                position: fija
                                                                    ? 'sticky'
                                                                    : undefined,
                                                                left: obtenerOffsetColumnaFija(
                                                                    indiceColumna
                                                                ),
                                                                zIndex: fija ? 30 : 20,
                                                            }}
                                                        >
                                                            <span className="flex items-center justify-center gap-1">
                                                                <span>
                                                                    {columna.titulo}
                                                                </span>
                                                                <ChevronDown
                                                                    size={11}
                                                                    className="shrink-0 opacity-50"
                                                                />
                                                            </span>
                                                        </th>
                                                    );
                                                }
                                            )}
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {filasVistaPrevia.map((fila, indiceFila) => (
                                            <tr
                                                key={`${fila.valores[0]}-${indiceFila}`}
                                            >
                                                {fila.valores.map(
                                                    (valor, indiceColumna) => {
                                                        const columna =
                                                            COLUMNAS_REPORTE_OPERACIONES[
                                                                indiceColumna
                                                            ];
                                                        const estilo =
                                                            obtenerEstiloGrupo(
                                                                columna.grupo
                                                            );
                                                        const estanciaPendiente =
                                                            indiceColumna === 16 &&
                                                            fila.estanciaPendiente;
                                                        const estanciaCsaePendiente =
                                                            indiceColumna === 20 &&
                                                            fila.estanciaCsaePendiente;
                                                        const pendiente =
                                                            estanciaPendiente ||
                                                            estanciaCsaePendiente;
                                                        const texto =
                                                            formatearValorVistaPreviaReporte(
                                                                valor,
                                                                indiceColumna
                                                            );
                                                        const fija = indiceColumna <= 2;
                                                        const esCeldaCsaeMultilinea =
                                                            indiceColumna >= 18 &&
                                                            indiceColumna <= 20;

                                                        return (
                                                            <td
                                                                key={`${indiceFila}-${indiceColumna}`}
                                                                className={`px-2 text-[12px] ${
                                                                    esCeldaCsaeMultilinea
                                                                        ? 'whitespace-pre-line py-2 leading-5'
                                                                        : 'h-[33px] whitespace-nowrap py-1.5'
                                                                }`}
                                                                title={texto}
                                                                style={{
                                                                    width: obtenerAnchoColumna(
                                                                        columna.ancho
                                                                    ),
                                                                    minWidth:
                                                                        obtenerAnchoColumna(
                                                                            columna.ancho
                                                                        ),
                                                                    maxWidth:
                                                                        obtenerAnchoColumna(
                                                                            columna.ancho
                                                                        ),
                                                                    backgroundColor:
                                                                        estanciaPendiente
                                                                            ? ESTILOS_REPORTE_OPERACIONES
                                                                                  .salida
                                                                                  .encabezado
                                                                            : estilo.cuerpo,
                                                                    color: pendiente
                                                                        ? ESTILOS_REPORTE_OPERACIONES
                                                                              .salida
                                                                              .texto
                                                                        : ESTILOS_REPORTE_OPERACIONES.texto,
                                                                    border: `1px solid ${ESTILOS_REPORTE_OPERACIONES.borde}`,
                                                                    fontWeight: pendiente
                                                                        ? 700
                                                                        : 400,
                                                                    position: fija
                                                                        ? 'sticky'
                                                                        : undefined,
                                                                    left: obtenerOffsetColumnaFija(
                                                                        indiceColumna
                                                                    ),
                                                                    zIndex: fija ? 10 : 1,
                                                                    whiteSpace:
                                                                        esCeldaCsaeMultilinea
                                                                            ? 'pre-line'
                                                                            : 'nowrap',
                                                                    overflow: 'hidden',
                                                                    textOverflow:
                                                                        esCeldaCsaeMultilinea
                                                                            ? undefined
                                                                            : 'ellipsis',
                                                                    verticalAlign:
                                                                        'middle',
                                                                }}
                                                            >
                                                                {texto || '\u00A0'}
                                                            </td>
                                                        );
                                                    }
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={descargando}
                        className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                        Cerrar
                    </button>

                    <button
                        type="button"
                        onClick={descargarExcel}
                        disabled={
                            datos.length === 0 ||
                            !fechaReporte ||
                            cargando ||
                            descargando
                        }
                        className="flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {descargando ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Download size={16} />
                        )}
                        Descargar Excel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExcelOperacionesModal;
