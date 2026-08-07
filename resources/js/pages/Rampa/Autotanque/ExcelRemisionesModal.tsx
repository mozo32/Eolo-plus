import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Download,
    FileSpreadsheet,
    Loader2,
    RefreshCw,
    X
} from 'lucide-react';
import {
    ASA_EXCEL_COLORS,
    COMPRAS_ASA_EXCEL,
    descargarExcelRemisiones,
    formatearFechaASAExcel,
    formatearLitrosASAExcel,
    formatearMonedaASAExcel,
    prepararExcelRemisiones,
    VENTAS_ASA_EXCEL,
    type ReporteASAExcel
} from './ExcelRemisiones';

interface ExcelRemisionesModalProps {
    open: boolean;
    onClose: () => void;
    cargarRegistros: () => Promise<any[]>;
}

type HojaActiva = 'ventas' | 'compras';

const ExcelRemisionesModal = ({
    open,
    onClose,
    cargarRegistros
}: ExcelRemisionesModalProps) => {
    const [cargando, setCargando] = useState(false);
    const [descargando, setDescargando] = useState(false);
    const [error, setError] = useState('');
    const [reporte, setReporte] = useState<ReporteASAExcel | null>(null);
    const [hojaActiva, setHojaActiva] = useState<HojaActiva>('ventas');
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

            const reportePreparado = await prepararExcelRemisiones(registros);

            if (solicitudActual !== solicitudRef.current) return;

            setReporte(reportePreparado);
            setHojaActiva(
                reportePreparado.ventas.length > 0 ? 'ventas' : 'compras'
            );
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
            setHojaActiva('ventas');
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
            descargarExcelRemisiones(reporte.blob);
        } finally {
            setDescargando(false);
        }
    };

    if (!open) return null;

    const configuracionActiva = hojaActiva === 'ventas'
        ? VENTAS_ASA_EXCEL
        : COMPRAS_ASA_EXCEL;
    const cantidadActiva = hojaActiva === 'ventas'
        ? reporte?.ventas.length ?? 0
        : reporte?.compras.length ?? 0;

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
                                Reporte ASA de ventas y compras
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

                {!cargando && !error && reporte && (
                    <div className="flex shrink-0 items-end gap-1 overflow-x-auto border-b border-slate-300 bg-slate-100 px-4 pt-3">
                        <button
                            type="button"
                            onClick={() => setHojaActiva('ventas')}
                            className={`whitespace-nowrap rounded-t-lg border border-b-0 px-4 py-2.5 text-[11px] font-black uppercase tracking-wide transition-colors ${
                                hojaActiva === 'ventas'
                                    ? 'border-slate-300 bg-white text-emerald-700'
                                    : 'border-transparent bg-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            Ventas ASA ({reporte.ventas.length})
                        </button>

                        <button
                            type="button"
                            onClick={() => setHojaActiva('compras')}
                            className={`whitespace-nowrap rounded-t-lg border border-b-0 px-4 py-2.5 text-[11px] font-black uppercase tracking-wide transition-colors ${
                                hojaActiva === 'compras'
                                    ? 'border-slate-300 bg-white text-emerald-700'
                                    : 'border-transparent bg-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                            Compras ASA ({reporte.compras.length})
                        </button>
                    </div>
                )}

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
                                Consultando ventas y compras del reporte...
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
                                    aria-label={`Vista previa de ${configuracionActiva.nombre}`}
                                    style={{ fontFamily: 'Calibri, Arial, sans-serif' }}
                                >
                                    <colgroup>
                                        {configuracionActiva.columnas.map((columna) => (
                                            <col
                                                key={columna.key}
                                                style={{ width: `${columna.width * 7}px` }}
                                            />
                                        ))}
                                    </colgroup>

                                    <thead>
                                        <tr style={{ height: '32px' }}>
                                            {configuracionActiva.columnas.map((columna) => (
                                                <th
                                                    key={columna.key}
                                                    className="border border-slate-700 px-2 text-center text-[14px] font-bold text-white"
                                                    style={{
                                                        backgroundColor: `#${ASA_EXCEL_COLORS.header}`
                                                    }}
                                                >
                                                    {columna.header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>

                                    {hojaActiva === 'ventas' ? (
                                        <tbody>
                                            {reporte.ventas.map((fila, index) => {
                                                const celdas = [
                                                    fila.folio,
                                                    formatearFechaASAExcel(fila.fecha),
                                                    fila.matricula,
                                                    formatearLitrosASAExcel(fila.litros),
                                                    fila.vta,
                                                    fila.factura,
                                                    formatearMonedaASAExcel(fila.precioVenta),
                                                    formatearMonedaASAExcel(fila.importe),
                                                    fila.cliente,
                                                    fila.formaPago,
                                                    fila.mes,
                                                    fila.status
                                                ];

                                                return (
                                                    <tr
                                                        key={`${fila.folio}-${index}`}
                                                        style={{ height: '27px' }}
                                                    >
                                                        {celdas.map((valor, cellIndex) => (
                                                            <td
                                                                key={`${fila.folio}-${index}-${cellIndex}`}
                                                                className="border px-2 text-center text-[14px] text-slate-800"
                                                                style={{
                                                                    borderColor: `#${ASA_EXCEL_COLORS.border}`
                                                                }}
                                                            >
                                                                {valor}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    ) : (
                                        <tbody>
                                            {reporte.compras.map((fila, index) => {
                                                const celdas = [
                                                    fila.folio,
                                                    formatearFechaASAExcel(fila.fecha),
                                                    formatearLitrosASAExcel(fila.litros),
                                                    fila.factura,
                                                    formatearMonedaASAExcel(fila.precioVenta),
                                                    formatearMonedaASAExcel(fila.importe)
                                                ];

                                                return (
                                                    <tr
                                                        key={`${fila.folio}-${index}`}
                                                        style={{ height: '27px' }}
                                                    >
                                                        {celdas.map((valor, cellIndex) => (
                                                            <td
                                                                key={`${fila.folio}-${index}-${cellIndex}`}
                                                                className="border px-2 text-center text-[14px] text-slate-800"
                                                                style={{
                                                                    borderColor: `#${ASA_EXCEL_COLORS.border}`
                                                                }}
                                                            >
                                                                {valor}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    )}
                                </table>

                                {cantidadActiva === 0 && (
                                    <div className="border-t border-slate-200 px-6 py-10 text-center text-sm text-slate-400">
                                        Esta hoja no contiene registros.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {reporte
                            ? `${reporte.ventas.length} ventas · ${reporte.compras.length} compras`
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

export default ExcelRemisionesModal;
