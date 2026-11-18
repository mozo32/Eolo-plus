import { useEffect, useMemo, useState } from 'react';
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
    /** Uno o varios meses en formato '2026-09'. El libro lleva una hoja por cada uno. */
    meses: string[];
    onClose: () => void;
}

export default function ModalExcelEstacionamiento({ meses, onClose }: Props) {
    const [rejillas, setRejillas] = useState<RejillaExcelEstacionamiento[]>([]);
    const [fallidos, setFallidos] = useState<string[]>([]);
    const [mesActivo, setMesActivo] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [descargando, setDescargando] = useState(false);
    const [error, setError] = useState('');

    /*
     * La dependencia es la clave de texto y no el arreglo: si el padre arma
     * `meses` en el render, su identidad cambia cada vez y el efecto consultaría
     * el servidor en bucle.
     */
    const clave = meses.join(',');

    useEffect(() => {
        let vigente = true;

        const consultar = async () => {
            setCargando(true);
            setError('');
            setFallidos([]);
            setMesActivo(0);

            /*
             * `allSettled` y no `all`: con varios meses, uno que falle no debe
             * tirar los demás. Se enseña lo que llegó y se dice cuáles no.
             */
            const resultados = await Promise.allSettled(
                meses.map(mes => obtenerExcelEstacionamiento(mes)),
            );

            if (!vigente) {
                return;
            }

            const llegaron: RejillaExcelEstacionamiento[] = [];
            const noLlegaron: string[] = [];

            resultados.forEach((resultado, indice) => {
                if (resultado.status === 'fulfilled') {
                    llegaron.push(resultado.value);
                } else {
                    noLlegaron.push(meses[indice]);
                }
            });

            setRejillas(llegaron);
            setFallidos(noLlegaron);

            if (llegaron.length === 0) {
                setError('No fue posible consultar los registros de ningún mes.');
            }

            setCargando(false);
        };

        void consultar();

        // Si el modal se cierra antes de que lleguen las respuestas, no se toca el
        // estado de un componente ya desmontado.
        return () => {
            vigente = false;
        };
    }, [clave]);

    const conFilas = useMemo(
        () => rejillas.filter(rejilla => rejilla.filas.length > 0),
        [rejillas],
    );

    const rejilla = rejillas[mesActivo] ?? null;
    const hayAlgoQueDescargar = conFilas.length > 0;
    const dias = rejilla ? Array.from({ length: rejilla.dias }, (_, i) => i + 1) : [];

    const descargar = async () => {
        if (!hayAlgoQueDescargar) {
            return;
        }

        setDescargando(true);
        setError('');

        try {
            await descargarExcelEstacionamiento(conFilas);
        } catch (e: any) {
            setError(e?.message || 'No fue posible generar el archivo de Excel.');
        } finally {
            setDescargando(false);
        }
    };

    const encabezado =
        meses.length === 1
            ? `Vista previa del Excel: ${tituloDelMes(meses[0])}`
            : `Vista previa del Excel: ${meses.length} meses`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="text-emerald-600" size={20} />
                        <h3 className="font-bold text-slate-800">{encabezado}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Una pestaña por mes, como en la vista previa de Pernocta del día. */}
                {!cargando && rejillas.length > 1 && (
                    <div className="flex gap-1 overflow-x-auto border-b bg-white px-4 pt-3">
                        {rejillas.map((cada, indice) => (
                            <button
                                key={cada.mes}
                                type="button"
                                onClick={() => setMesActivo(indice)}
                                className={`whitespace-nowrap rounded-t-lg px-4 py-2 text-xs font-bold transition-colors ${
                                    indice === mesActivo
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {tituloDelMes(cada.mes)}
                                {cada.filas.length === 0 && ' (vacío)'}
                            </button>
                        ))}
                    </div>
                )}

                <div className="overflow-auto flex-1 bg-white p-4">
                    {error && (
                        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-xs font-medium">
                            {error}
                        </div>
                    )}

                    {fallidos.length > 0 && (
                        <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium">
                            No se pudieron consultar {fallidos.length}{' '}
                            {fallidos.length === 1 ? 'mes' : 'meses'} (
                            {fallidos.map(tituloDelMes).join(', ')}); el resto sí está.
                        </div>
                    )}

                    {cargando && (
                        <p className="text-sm text-slate-400 italic">
                            {meses.length === 1
                                ? 'Consultando el mes...'
                                : `Consultando ${meses.length} meses...`}
                        </p>
                    )}

                    {!cargando && rejilla !== null && rejilla.filas.length === 0 && (
                        <p className="text-sm text-slate-400 italic">
                            No hay registros en este mes.
                        </p>
                    )}

                    {!cargando && rejilla !== null && rejilla.filas.length > 0 && (
                        <>
                            <p className="mb-3 text-xs text-slate-500">
                                {rejilla.filas.length}{' '}
                                {rejilla.filas.length === 1 ? 'placa' : 'placas'} en{' '}
                                {rejilla.dias} días.
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
                                    {rejilla.filas.map(fila => {
                                        const presentes = new Set(fila.dias);

                                        return (
                                            <tr key={fila.placas}>
                                                {COLUMNAS_FIJAS.map(columna => (
                                                    <td
                                                        key={columna.clave}
                                                        className="p-2 text-slate-700 whitespace-nowrap border border-slate-200"
                                                    >
                                                        {fila[columna.clave] ?? ''}
                                                    </td>
                                                ))}
                                                {/* Los hex son los MISMOS que el libro (C6E0B4 / BDD7EE), no
                                                    un verde parecido: si la previa y el Excel no coinciden,
                                                    la previa deja de servir para lo que existe. */}
                                                {dias.map(dia => (
                                                    <td
                                                        key={dia}
                                                        className={`p-1 text-center border border-slate-400 text-slate-900 ${
                                                            presentes.has(dia)
                                                                ? 'bg-[#C6E0B4] font-bold'
                                                                : 'bg-[#BDD7EE]'
                                                        }`}
                                                    >
                                                        {presentes.has(dia) ? 1 : 0}
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

                <div className="p-4 border-t bg-slate-50 flex justify-between items-center gap-2">
                    <p className="text-xs text-slate-500">
                        {hayAlgoQueDescargar && rejillas.length > 1
                            ? `El archivo llevará ${conFilas.length} ${
                                  conFilas.length === 1 ? 'hoja' : 'hojas'
                              }; los meses vacíos no se incluyen.`
                            : ''}
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                        >
                            Cerrar
                        </button>
                        <button
                            onClick={descargar}
                            disabled={!hayAlgoQueDescargar || descargando}
                            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <Download size={16} />
                            {descargando ? 'Generando...' : 'Descargar Excel'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
