import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Download,
    FileSpreadsheet,
    Loader2,
    RefreshCw,
    X
} from 'lucide-react';
import {
    AUTOTANQUE_INSPECCIONES_EXCEL,
    COMBUSTIBLE_EXCEL,
    INSPECCIONES_EXCEL_COLORS,
    descargarInspeccionesExcel,
    formatearFechaInspeccionExcel,
    prepararInspeccionesExcel,
    type ReporteInspeccionesExcel,
    type SeccionMesExcel,
    type DetalleAutotanqueInspeccionExcel,
    type DetalleCombustibleExcel
} from './excelService';

interface ExcelInspeccionesModalProps {
    open: boolean;
    onClose: () => void;
    cargarRegistros: () => Promise<any[]>;
}

type HojaActiva = 'combustible' | 'autotanque';

interface TablaExcelProps {
    titulo: string;
    generado: string;
    headers: readonly string[];
    widths: readonly number[];
    children: React.ReactNode;
}

const TablaExcel = ({
    titulo,
    generado,
    headers,
    widths,
    children
}: TablaExcelProps) => (
    <div className="mx-auto w-max min-w-full overflow-hidden bg-white shadow-lg">
        <table
            className="border-separate border-spacing-0 text-slate-800"
            style={{ fontFamily: 'Calibri, Arial, sans-serif' }}
        >
            <colgroup>
                {widths.map((width, index) => (
                    <col
                        key={`${width}-${index}`}
                        style={{ width: `${width * 7}px` }}
                    />
                ))}
            </colgroup>

            <thead>
                <tr style={{ height: '34px' }}>
                    <th
                        colSpan={headers.length}
                        className="px-4 text-center text-[21px] font-bold text-white"
                        style={{
                            backgroundColor: `#${INSPECCIONES_EXCEL_COLORS.title}`
                        }}
                    >
                        {titulo}
                    </th>
                </tr>

                <tr style={{ height: '24px' }}>
                    <th
                        colSpan={headers.length}
                        className="bg-white px-2 text-left text-[14px] font-normal text-slate-800"
                    >
                        Generado: {generado}
                    </th>
                </tr>

                <tr style={{ height: '38px' }}>
                    {headers.map((header) => (
                        <th
                            key={header}
                            className="border border-slate-700 px-2 text-center text-[15px] font-bold leading-tight text-white"
                            style={{
                                backgroundColor: `#${INSPECCIONES_EXCEL_COLORS.header}`
                            }}
                        >
                            {header}
                        </th>
                    ))}
                </tr>
            </thead>

            <tbody>{children}</tbody>
        </table>
    </div>
);

const claseCelda =
    'border border-slate-200 px-2 py-2 text-center align-middle text-[14px] leading-snug whitespace-normal';

const FilaMes = ({ mes, columnas }: { mes: string; columnas: number }) => (
    <tr style={{ height: '26px' }}>
        <td
            className="px-2 text-center text-[14px] font-bold"
            style={{
                color: `#${INSPECCIONES_EXCEL_COLORS.monthText}`,
                backgroundColor: `#${INSPECCIONES_EXCEL_COLORS.monthFill}`
            }}
        >
            MES: {mes}
        </td>
        <td colSpan={columnas - 1} className="bg-white" />
    </tr>
);

const VistaCombustible = ({
    secciones,
    generado
}: {
    secciones: SeccionMesExcel<DetalleCombustibleExcel>[];
    generado: string;
}) => (
    <TablaExcel
        titulo={COMBUSTIBLE_EXCEL.titulo}
        generado={generado}
        headers={COMBUSTIBLE_EXCEL.headers}
        widths={COMBUSTIBLE_EXCEL.widths}
    >
        {secciones.map((seccion, indiceSeccion) => (
            <React.Fragment key={`${seccion.mes}-${indiceSeccion}`}>
                <FilaMes
                    mes={seccion.mes}
                    columnas={COMBUSTIBLE_EXCEL.headers.length}
                />

                {seccion.inspecciones.map((inspeccion, indiceInspeccion) =>
                    inspeccion.detalles.map((detalle, indiceDetalle) => (
                        <tr
                            key={`${inspeccion.id}-${indiceInspeccion}-${indiceDetalle}`}
                        >
                            {indiceDetalle === 0 && (
                                <>
                                    <td
                                        rowSpan={inspeccion.detalles.length}
                                        className={claseCelda}
                                    >
                                        {inspeccion.id}
                                    </td>
                                    <td
                                        rowSpan={inspeccion.detalles.length}
                                        className={claseCelda}
                                    >
                                        {inspeccion.mes}
                                    </td>
                                    <td
                                        rowSpan={inspeccion.detalles.length}
                                        className={claseCelda}
                                    >
                                        {formatearFechaInspeccionExcel(
                                            inspeccion.fecha
                                        )}
                                    </td>
                                </>
                            )}

                            <td className={claseCelda}>{detalle.prueba}</td>
                            <td className={claseCelda}>{detalle.resultado}</td>
                        </tr>
                    ))
                )}
            </React.Fragment>
        ))}
    </TablaExcel>
);

const VistaAutotanque = ({
    secciones,
    generado
}: {
    secciones: SeccionMesExcel<DetalleAutotanqueInspeccionExcel>[];
    generado: string;
}) => (
    <TablaExcel
        titulo={AUTOTANQUE_INSPECCIONES_EXCEL.titulo}
        generado={generado}
        headers={AUTOTANQUE_INSPECCIONES_EXCEL.headers}
        widths={AUTOTANQUE_INSPECCIONES_EXCEL.widths}
    >
        {secciones.map((seccion, indiceSeccion) => (
            <React.Fragment key={`${seccion.mes}-${indiceSeccion}`}>
                <FilaMes
                    mes={seccion.mes}
                    columnas={AUTOTANQUE_INSPECCIONES_EXCEL.headers.length}
                />

                {seccion.inspecciones.map((inspeccion, indiceInspeccion) =>
                    inspeccion.detalles.map((detalle, indiceDetalle) => (
                        <tr
                            key={`${inspeccion.id}-${indiceInspeccion}-${indiceDetalle}`}
                        >
                            {indiceDetalle === 0 && (
                                <>
                                    <td
                                        rowSpan={inspeccion.detalles.length}
                                        className={claseCelda}
                                    >
                                        {inspeccion.id}
                                    </td>
                                    <td
                                        rowSpan={inspeccion.detalles.length}
                                        className={claseCelda}
                                    >
                                        {inspeccion.mes}
                                    </td>
                                    <td
                                        rowSpan={inspeccion.detalles.length}
                                        className={claseCelda}
                                    >
                                        {formatearFechaInspeccionExcel(
                                            inspeccion.fecha
                                        )}
                                    </td>
                                </>
                            )}

                            <td className={claseCelda}>{detalle.nombreDren}</td>
                            <td className={claseCelda}>{detalle.tomaMuestra}</td>
                            <td className={claseCelda}>{detalle.claridad}</td>
                            <td className={claseCelda}>{detalle.solidosAgua}</td>
                        </tr>
                    ))
                )}
            </React.Fragment>
        ))}
    </TablaExcel>
);

const ExcelInspeccionesModal = ({
    open,
    onClose,
    cargarRegistros
}: ExcelInspeccionesModalProps) => {
    const [cargando, setCargando] = useState(false);
    const [descargando, setDescargando] = useState(false);
    const [error, setError] = useState('');
    const [reporte, setReporte] = useState<ReporteInspeccionesExcel | null>(null);
    const [hojaActiva, setHojaActiva] = useState<HojaActiva>('combustible');
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
                    'No hay inspecciones para mostrar con los filtros seleccionados.'
                );
            }

            const reportePreparado = await prepararInspeccionesExcel(registros);

            if (solicitudActual !== solicitudRef.current) return;

            setReporte(reportePreparado);
            setHojaActiva(
                reportePreparado.combustible.totalInspecciones > 0
                    ? 'combustible'
                    : 'autotanque'
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
            setHojaActiva('combustible');
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
            descargarInspeccionesExcel(reporte.blob);
        } finally {
            setDescargando(false);
        }
    };

    if (!open) return null;

    const hojaSeleccionada = reporte?.[hojaActiva];

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
                                Reporte de inspecciones de combustible
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

                {reporte && !cargando && !error && (
                    <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3">
                        <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Hoja:
                        </span>

                        {([
                            {
                                value: 'combustible' as const,
                                label: 'Combustible',
                                total: reporte.combustible.totalInspecciones
                            },
                            {
                                value: 'autotanque' as const,
                                label: 'Autotanque',
                                total: reporte.autotanque.totalInspecciones
                            }
                        ]).map((opcion) => (
                            <button
                                key={opcion.value}
                                type="button"
                                onClick={() => setHojaActiva(opcion.value)}
                                className={`rounded-lg border px-4 py-2 text-[10px] font-black uppercase tracking-wide transition-colors ${
                                    hojaActiva === opcion.value
                                        ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                                        : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-700'
                                }`}
                            >
                                {opcion.label} ({opcion.total})
                            </button>
                        ))}
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
                                Preparando las hojas Combustible y Autotanque...
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
                            {hojaActiva === 'combustible' ? (
                                <VistaCombustible
                                    secciones={reporte.combustible.secciones}
                                    generado={reporte.generado}
                                />
                            ) : (
                                <VistaAutotanque
                                    secciones={reporte.autotanque.secciones}
                                    generado={reporte.generado}
                                />
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {hojaSeleccionada
                            ? `${hojaSeleccionada.totalInspecciones} inspecciones · ${hojaSeleccionada.totalFilas} filas de detalle`
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

export default ExcelInspeccionesModal;
