import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Download,
    FileSpreadsheet,
    Loader2,
    RefreshCw,
    X
} from 'lucide-react';
import {
    AUTOTANQUE_EXCEL_COLORS,
    AUTOTANQUE_EXCEL_COLUMN_WIDTHS,
    AUTOTANQUE_EXCEL_HEADERS,
    descargarAutotanqueExcel,
    formatearFechaAutotanqueExcel,
    formatearNumeroAutotanqueExcel,
    prepararAutotanqueExcel,
    type ReporteAutotanqueExcel
} from './excelService';

interface ExcelAutotanqueModalProps {
    open: boolean;
    onClose: () => void;
    cargarRegistros: () => Promise<any[]>;
}

const ExcelAutotanqueModal = ({
    open,
    onClose,
    cargarRegistros
}: ExcelAutotanqueModalProps) => {
    const [cargando, setCargando] = useState(false);
    const [descargando, setDescargando] = useState(false);
    const [error, setError] = useState('');
    const [reporte, setReporte] = useState<ReporteAutotanqueExcel | null>(null);
    const solicitudRef = useRef(0);

    const cargarVistaPrevia = useCallback(async () => {
        const solicitudActual = ++solicitudRef.current;

        setCargando(true);
        setError('');
        setReporte(null);

        try {
            const registros = await cargarRegistros();

            if (solicitudActual !== solicitudRef.current) return;

            if (!registros.length) {
                throw new Error(
                    'No hay registros para mostrar con los filtros seleccionados.'
                );
            }

            const reportePreparado = await prepararAutotanqueExcel(registros);

            if (solicitudActual !== solicitudRef.current) return;

            setReporte(reportePreparado);
        } catch (error: any) {
            if (solicitudActual !== solicitudRef.current) return;

            setError(
                error?.message ||
                'No fue posible generar la vista previa del Excel.'
            );
        } finally {
            if (solicitudActual === solicitudRef.current) {
                setCargando(false);
            }
        }
    }, [cargarRegistros]);

    useEffect(() => {
        if (!open) {
            solicitudRef.current += 1;
            setCargando(false);
            setDescargando(false);
            setError('');
            setReporte(null);
            return;
        }

        void cargarVistaPrevia();

        return () => {
            solicitudRef.current += 1;
        };
    }, [open, cargarVistaPrevia]);

    useEffect(() => {
        if (!open) return;

        const cerrarConEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };

        document.addEventListener('keydown', cerrarConEscape);
        document.body.style.overflow = 'hidden';

        return () => {
            document.removeEventListener('keydown', cerrarConEscape);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    const descargarExcel = () => {
        if (!reporte) return;

        setDescargando(true);

        try {
            descargarAutotanqueExcel(reporte.blob);
        } finally {
            setDescargando(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5">
            <div
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                onClick={onClose}
            />

            <div className="relative z-10 flex h-[94vh] w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <FileSpreadsheet size={20} />
                        </div>

                        <div className="min-w-0">
                            <h2 className="truncate text-sm font-black uppercase tracking-wide text-slate-800">
                                Vista previa del Excel
                            </h2>
                            <p className="truncate text-xs text-slate-500">
                                Reporte de entrega de turno - Autotanque
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        title="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 bg-slate-200 p-3 sm:p-4">
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
                                Consultando todos los registros del reporte...
                            </p>
                        </div>
                    )}

                    {!cargando && error && (
                        <div className="flex h-full flex-col items-center justify-center rounded-xl border border-red-200 bg-white px-6 text-center">
                            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                                <FileSpreadsheet size={28} />
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

                    {!cargando && !error && reporte && (
                        <div className="h-full overflow-auto rounded-xl border border-slate-300 bg-slate-100 p-4 shadow-inner">
                            <div className="mx-auto w-max min-w-full overflow-hidden bg-white shadow-lg">
                                <table
                                    className="border-separate border-spacing-0 text-slate-800"
                                    aria-label="Vista previa del reporte de Autotanque"
                                    style={{ fontFamily: 'Calibri, Arial, sans-serif' }}
                                >
                                    <colgroup>
                                        {AUTOTANQUE_EXCEL_COLUMN_WIDTHS.map((width, index) => (
                                            <col
                                                key={`${width}-${index}`}
                                                style={{ width: `${width * 7}px` }}
                                            />
                                        ))}
                                    </colgroup>

                                    <thead>
                                        <tr style={{ height: '40px' }}>
                                            <th
                                                colSpan={AUTOTANQUE_EXCEL_HEADERS.length}
                                                className="px-4 text-center text-[19px] font-black text-white"
                                                style={{
                                                    backgroundColor: `#${AUTOTANQUE_EXCEL_COLORS.title}`,
                                                    fontFamily: 'Arial Black, Arial, sans-serif'
                                                }}
                                            >
                                                REPORTE DE ENTREGA DE TURNO - AUTOTANQUE
                                            </th>
                                        </tr>

                                        <tr style={{ height: '20px' }}>
                                            <th
                                                colSpan={AUTOTANQUE_EXCEL_HEADERS.length}
                                                className="bg-white"
                                                aria-hidden="true"
                                            />
                                        </tr>

                                        <tr style={{ height: '34px' }}>
                                            {AUTOTANQUE_EXCEL_HEADERS.map((header) => (
                                                <th
                                                    key={header}
                                                    className="border border-slate-700 px-2 text-center text-[13px] font-bold text-white"
                                                    style={{
                                                        backgroundColor: `#${AUTOTANQUE_EXCEL_COLORS.header}`
                                                    }}
                                                >
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {reporte.filas.map((fila) => {
                                            const celdas = [
                                                fila.numero,
                                                fila.responsableInicio,
                                                formatearFechaAutotanqueExcel(fila.fechaInicio),
                                                formatearNumeroAutotanqueExcel(fila.cmInicial),
                                                formatearNumeroAutotanqueExcel(fila.litrosInicial),
                                                formatearNumeroAutotanqueExcel(fila.totalizadorInicial),
                                                fila.responsableCierre,
                                                formatearFechaAutotanqueExcel(fila.fechaCierre),
                                                formatearNumeroAutotanqueExcel(fila.cmCierre),
                                                formatearNumeroAutotanqueExcel(fila.litrosCierre),
                                                formatearNumeroAutotanqueExcel(fila.totalizadorCierre),
                                                formatearNumeroAutotanqueExcel(fila.diferencia)
                                            ];

                                            return (
                                                <tr
                                                    key={fila.numero}
                                                    style={{ height: '30px' }}
                                                >
                                                    {celdas.map((valor, index) => (
                                                        <td
                                                            key={`${fila.numero}-${index}`}
                                                            className={`border-b border-slate-200 px-2 text-center text-[14px] whitespace-nowrap ${
                                                                index === 11 && fila.diferencia < 0
                                                                    ? 'font-bold text-red-600'
                                                                    : 'text-slate-700'
                                                            }`}
                                                        >
                                                            {valor}
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {reporte
                            ? `${reporte.filas.length} registros incluidos`
                            : 'Esperando información del reporte'}
                    </p>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-black uppercase tracking-wide text-slate-600 transition-colors hover:bg-slate-50"
                        >
                            Cerrar
                        </button>

                        <button
                            type="button"
                            onClick={descargarExcel}
                            disabled={!reporte || cargando || descargando}
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
        </div>
    );
};

export default ExcelAutotanqueModal;
