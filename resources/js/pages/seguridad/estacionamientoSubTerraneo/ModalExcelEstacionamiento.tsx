import { useEffect, useState } from 'react';
import { X, FileSpreadsheet, Download } from 'lucide-react';
import {
    obtenerExcelEstacionamiento,
    type RejillaExcelEstacionamiento,
} from '@/stores/apiEstacionamientoSubterraneo';
import {
    COLUMNAS_FIJAS,
    tituloDelMes,
    descargarExcelEstacionamiento,
} from './excelEstacionamientoService';

interface Props {
    mes: string;
    onClose: () => void;
}

export default function ModalExcelEstacionamiento({ mes, onClose }: Props) {
    const [rejilla, setRejilla] = useState<RejillaExcelEstacionamiento | null>(null);
    const [cargando, setCargando] = useState(true);
    const [descargando, setDescargando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let vigente = true;

        const consultar = async () => {
            setCargando(true);
            setError('');

            try {
                const resultado = await obtenerExcelEstacionamiento(mes);

                if (vigente) {
                    setRejilla(resultado);
                }
            } catch (e: any) {
                if (vigente) {
                    setRejilla(null);
                    setError(e?.message || 'No fue posible consultar los registros del mes.');
                }
            } finally {
                if (vigente) {
                    setCargando(false);
                }
            }
        };

        consultar();

        // Si el modal se cierra antes de que llegue la respuesta, no se toca el estado
        // de un componente ya desmontado.
        return () => {
            vigente = false;
        };
    }, [mes]);

    const descargar = async () => {
        if (!rejilla || rejilla.filas.length === 0) {
            return;
        }

        setDescargando(true);
        setError('');

        try {
            await descargarExcelEstacionamiento(rejilla);
        } catch (e: any) {
            setError(e?.message || 'No fue posible generar el archivo de Excel.');
        } finally {
            setDescargando(false);
        }
    };

    const hayFilas = rejilla !== null && rejilla.filas.length > 0;
    const dias = rejilla ? Array.from({ length: rejilla.dias }, (_, i) => i + 1) : [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="text-emerald-600" size={20} />
                        <h3 className="font-bold text-slate-800">
                            Vista previa del Excel: {tituloDelMes(mes)}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="overflow-auto flex-1 bg-white p-4">
                    {error && (
                        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                            {error}
                        </div>
                    )}

                    {cargando && (
                        <p className="text-sm text-slate-400 italic">Consultando el mes...</p>
                    )}

                    {!cargando && rejilla !== null && rejilla.filas.length === 0 && (
                        <p className="text-sm text-slate-400 italic">
                            No hay registros en este mes.
                        </p>
                    )}

                    {!cargando && hayFilas && (
                        <>
                            <p className="mb-3 text-xs text-slate-500">
                                {rejilla!.filas.length}{' '}
                                {rejilla!.filas.length === 1 ? 'placa' : 'placas'} en{' '}
                                {rejilla!.dias} días.
                            </p>
                            <table className="text-left text-[11px] border-collapse">
                                <thead className="bg-slate-100">
                                    <tr>
                                        {COLUMNAS_FIJAS.map(columna => (
                                            <th
                                                key={columna.clave}
                                                className="p-2 font-semibold text-slate-600 whitespace-nowrap border border-slate-200"
                                            >
                                                {columna.titulo}
                                            </th>
                                        ))}
                                        {dias.map(dia => (
                                            <th
                                                key={dia}
                                                className="p-1 w-7 text-center font-semibold text-slate-600 border border-slate-200"
                                            >
                                                {dia}
                                            </th>
                                        ))}
                                        <th className="p-2 text-center font-semibold text-slate-600 border border-slate-200">
                                            TOTAL
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rejilla!.filas.map(fila => {
                                        const presentes = new Set(fila.dias);

                                        return (
                                            <tr key={fila.placas}>
                                                {COLUMNAS_FIJAS.map(columna => (
                                                    <td
                                                        key={columna.clave}
                                                        className="p-2 text-slate-700 whitespace-nowrap border border-slate-200"
                                                    >
                                                        {(fila[columna.clave] as string | null) ?? ''}
                                                    </td>
                                                ))}
                                                {dias.map(dia => (
                                                    <td
                                                        key={dia}
                                                        className={`p-1 text-center border border-slate-200 ${
                                                            presentes.has(dia)
                                                                ? 'bg-emerald-100 text-emerald-700 font-bold'
                                                                : ''
                                                        }`}
                                                    >
                                                        {presentes.has(dia) ? 1 : ''}
                                                    </td>
                                                ))}
                                                <td className="p-2 text-center font-bold text-slate-800 border border-slate-200">
                                                    {fila.total}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>

                <div className="p-4 border-t bg-slate-50 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                    >
                        Cerrar
                    </button>
                    <button
                        onClick={descargar}
                        disabled={!hayFilas || descargando}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <Download size={16} />
                        {descargando ? 'Generando...' : 'Descargar Excel'}
                    </button>
                </div>
            </div>
        </div>
    );
}
