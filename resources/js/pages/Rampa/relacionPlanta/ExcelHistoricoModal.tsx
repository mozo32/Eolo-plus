import { AlertCircle, Download, FileSpreadsheet, LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    COLUMNAS_EXCEL_HISTORICO,
    descargarExcelHistorico,
    traerFilasHistorico,
    type FilaExcelHistorico,
} from './excelHistoricoService';
import type { FiltrosHistorico } from './types';

interface Props {
    abierto: boolean;
    filtros: FiltrosHistorico;
    onCerrar: () => void;
}

/** Cuántas filas se pintan en la vista previa. La descarga siempre trae todas. */
const FILAS_VISTA_PREVIA = 100;

/**
 * Vista previa del Excel del histórico, con su botón de descarga.
 *
 * Pinta las columnas desde `COLUMNAS_EXCEL_HISTORICO`, la misma lista que usa
 * el archivo: lo que se ve aquí y lo que se descarga no pueden divergir porque
 * salen del mismo sitio, y las filas son literalmente el mismo arreglo.
 *
 * Los filtros viven en la página, no aquí, así que mientras el modal está
 * abierto no se pueden cambiar. Por eso no hace falta la lógica de invalidar
 * la consulta que sí tiene el modal hermano de Movimientos de Vehículos.
 */
export default function ExcelHistoricoModal({ abierto, filtros, onCerrar }: Props) {
    const [filas, setFilas] = useState<FilaExcelHistorico[] | null>(null);
    const [truncado, setTruncado] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [descargando, setDescargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!abierto) {
            // Se limpia al CERRAR: así al reabrir no se ve un instante el
            // resultado de la consulta anterior antes de la nueva.
            setFilas(null);
            setTruncado(false);
            setError(null);

            return;
        }

        let vigente = true;

        setCargando(true);
        setError(null);

        traerFilasHistorico(filtros)
            .then(resultado => {
                if (!vigente) {
                    return;
                }

                setFilas(resultado.filas);
                setTruncado(resultado.truncado);
            })
            .catch(e => {
                if (!vigente) {
                    return;
                }

                setFilas(null);
                setError(e instanceof Error ? e.message : 'No se pudo consultar el histórico.');
            })
            .finally(() => {
                if (vigente) {
                    setCargando(false);
                }
            });

        return () => {
            vigente = false;
        };
    }, [abierto, filtros]);

    if (!abierto) {
        return null;
    }

    const descargar = async () => {
        if (filas === null || filas.length === 0) {
            return;
        }

        setDescargando(true);
        setError(null);

        try {
            await descargarExcelHistorico(filas);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'No se pudo generar el archivo.');
        } finally {
            setDescargando(false);
        }
    };

    const vistaPrevia = (filas ?? []).slice(0, FILAS_VISTA_PREVIA);
    const hayFilas = filas !== null && filas.length > 0;

    return (
        <div className="fixed inset-0 z-50 flex animate-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm fade-in duration-200">
            <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b bg-slate-50 p-4">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="text-emerald-600" size={20} />
                        <h3 className="font-bold text-slate-800">Vista previa del Excel</h3>
                    </div>
                    <button type="button" onClick={onCerrar} className="rounded-full p-2 transition-colors hover:bg-slate-200">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-4">
                    {cargando ? (
                        <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
                            <LoaderCircle className="animate-spin" size={28} />
                            <p className="text-[10px] font-black uppercase tracking-widest">Consultando el histórico…</p>
                        </div>
                    ) : error !== null ? (
                        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                            <AlertCircle className="mt-0.5 shrink-0 text-red-500" size={18} />
                            <p className="text-sm font-medium text-red-700">{error}</p>
                        </div>
                    ) : !hayFilas ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 py-16 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                No hay préstamos que casen con los filtros
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="bg-[#003E51]">
                                        {COLUMNAS_EXCEL_HISTORICO.map(columna => (
                                            <th
                                                key={columna.clave}
                                                className="px-3 py-2 text-center text-[9px] font-black uppercase tracking-wider text-white"
                                            >
                                                {columna.titulo}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {vistaPrevia.map(fila => (
                                        <tr key={fila.numero} className="border-b border-slate-100 odd:bg-white even:bg-slate-50">
                                            {COLUMNAS_EXCEL_HISTORICO.map(columna => (
                                                <td key={columna.clave} className="px-3 py-1.5 text-center text-[11px] text-slate-600">
                                                    {String(fila[columna.clave] ?? '')}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="flex flex-col justify-between gap-3 border-t bg-slate-50 p-4 sm:flex-row sm:items-center">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {hayFilas && (
                            <>
                                <span>
                                    Mostrando {vistaPrevia.length} de {filas!.length}
                                    {filas!.length === 1 ? ' fila' : ' filas'}
                                </span>
                                {vistaPrevia.length < filas!.length && (
                                    <span className="ml-1 text-slate-400">· el archivo trae todas</span>
                                )}
                                {truncado && (
                                    <p className="mt-1 font-black text-amber-600">
                                        El tope recortó el resultado. Acota el filtro para exportar el resto.
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={descargar}
                        disabled={!hayFilas || descargando || cargando}
                        className="flex items-center justify-center gap-2 rounded border border-emerald-600 bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                    >
                        <Download size={14} />
                        <span>{descargando ? 'GENERANDO…' : 'DESCARGAR EXCEL'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
