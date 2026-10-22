import { useState } from 'react';
import { Search, X, FileSpreadsheet, Download } from 'lucide-react';
import { Vehiculo, FilaExcelVehiculo } from './types';
import { apiVehiculoEolo } from '@/stores/apiVehiculoEolo';
import { COLUMNAS_EXCEL_VEHICULOS, descargarExcelVehiculos } from './excelVehiculosService';

interface Props {
    isOpen: boolean;
    vehiculosSeleccionados: Vehiculo[];
    onClose: () => void;
}

/** Cuántas filas se pintan en la vista previa. La descarga siempre trae todas. */
const FILAS_VISTA_PREVIA = 100;

export const ExcelVehiculosModal = ({ isOpen, vehiculosSeleccionados, onClose }: Props) => {
    const [chofer, setChofer] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [tipo, setTipo] = useState<'Todos' | 'Entrada' | 'Salida'>('Todos');
    const [filas, setFilas] = useState<FilaExcelVehiculo[] | null>(null);
    const [consultando, setConsultando] = useState(false);
    const [descargando, setDescargando] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) {
        return null;
    }

    /**
     * Cambiar un filtro invalida lo consultado: así no se puede descargar un archivo
     * distinto del que se está viendo.
     */
    const invalidarConsulta = () => {
        setFilas(null);
        setError('');
    };

    const limpiarFiltros = () => {
        setChofer('');
        setFechaInicio('');
        setFechaFin('');
        setTipo('Todos');
        setFilas(null);
        setError('');
    };

    const consultar = async () => {
        setConsultando(true);
        setError('');

        try {
            const resultado = await apiVehiculoEolo.getExcel(
                vehiculosSeleccionados.map(v => v.id),
                { chofer, tipo, fechaInicio, fechaFin },
            );
            setFilas(resultado);
        } catch (e: any) {
            setFilas(null);
            setError(e?.message || 'No fue posible consultar los movimientos.');
        } finally {
            setConsultando(false);
        }
    };

    const descargar = async () => {
        if (!filas || filas.length === 0) {
            return;
        }

        setDescargando(true);
        setError('');

        try {
            await descargarExcelVehiculos(filas);
        } catch (e: any) {
            setError(e?.message || 'No fue posible generar el archivo de Excel.');
        } finally {
            setDescargando(false);
        }
    };

    const filasVistaPrevia = (filas ?? []).slice(0, FILAS_VISTA_PREVIA);
    const hayFilas = filas !== null && filas.length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="text-emerald-600" size={20} />
                        <h3 className="font-bold text-gray-800">
                            Exportar movimientos ({vehiculosSeleccionados.length}{' '}
                            {vehiculosSeleccionados.length === 1 ? 'vehículo' : 'vehículos'})
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-4 border-b bg-white">
                    <div className="flex justify-between items-center mb-3">
                        <p className="text-xs text-gray-500">
                            {vehiculosSeleccionados.map(v => `${v.nombre} (${v.id})`).join(', ')}
                        </p>
                        <button
                            onClick={limpiarFiltros}
                            disabled={consultando}
                            className="text-[10px] font-bold text-gray-400 hover:text-gray-600 disabled:opacity-40 tracking-wider"
                        >
                            LIMPIAR FILTROS
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                            <input
                                type="text"
                                placeholder="Chofer..."
                                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                value={chofer}
                                disabled={consultando}
                                onChange={(e) => { setChofer(e.target.value); invalidarConsulta(); }}
                            />
                        </div>
                        <div className="flex items-center gap-2 md:col-span-2">
                            <input
                                type="date"
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600 bg-white"
                                value={fechaInicio}
                                disabled={consultando}
                                onChange={(e) => { setFechaInicio(e.target.value); invalidarConsulta(); }}
                            />
                            <span className="text-gray-400 text-xs">-</span>
                            <input
                                type="date"
                                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600 bg-white"
                                value={fechaFin}
                                disabled={consultando}
                                onChange={(e) => { setFechaFin(e.target.value); invalidarConsulta(); }}
                            />
                        </div>
                        <select
                            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-gray-600 bg-white cursor-pointer"
                            value={tipo}
                            disabled={consultando}
                            onChange={(e) => { setTipo(e.target.value as 'Todos' | 'Entrada' | 'Salida'); invalidarConsulta(); }}
                        >
                            <option value="Todos">Todos los tipos</option>
                            <option value="Entrada">Entradas</option>
                            <option value="Salida">Salidas</option>
                        </select>
                        <button
                            onClick={consultar}
                            disabled={consultando}
                            className="px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                        >
                            {consultando ? 'Consultando...' : 'Consultar'}
                        </button>
                    </div>
                </div>

                <div className="overflow-auto flex-1 bg-white p-4">
                    {error && (
                        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                            {error}
                        </div>
                    )}

                    {filas === null && !consultando && (
                        <p className="text-sm text-gray-400 italic">
                            Ajusta los filtros y pulsa «Consultar» para ver qué se va a exportar.
                        </p>
                    )}

                    {filas !== null && filas.length === 0 && (
                        <p className="text-sm text-gray-400 italic">
                            No hay movimientos con esos filtros.
                        </p>
                    )}

                    {hayFilas && (
                        <>
                            <p className="mb-3 text-xs text-gray-500">
                                Mostrando {filasVistaPrevia.length} de {filas!.length} movimientos.
                                La descarga incluye los {filas!.length}.
                            </p>
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-100 border-b">
                                    <tr>
                                        {COLUMNAS_EXCEL_VEHICULOS.map(columna => (
                                            <th
                                                key={columna.clave}
                                                className="p-2 font-semibold text-gray-600 whitespace-nowrap"
                                            >
                                                {columna.titulo}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filasVistaPrevia.map((fila, indice) => (
                                        <tr key={indice} className="border-t border-gray-100">
                                            {COLUMNAS_EXCEL_VEHICULOS.map(columna => (
                                                <td key={columna.clave} className="p-2 text-gray-700">
                                                    {fila[columna.clave] ?? ''}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
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
};
