import React, { useState, useEffect } from 'react';
import { FormLlegada } from './FormLlegada';
import { FormSalida } from './FormSalida';
import { obtenerOperacionesDiariasApi } from '@/stores/apiOperacionesDiarias';

interface OperacionesCardsProps {
    moduloNombre?: string;
}

const OperacionesCards = ({ moduloNombre }: OperacionesCardsProps) => {
    const [registros, setRegistros] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stripExpandida, setStripExpandida] = useState<number | null>(null);
    const [creando, setCreando] = useState<'llegada' | 'salida' | null>(null);

    const [filtros, setFiltros] = useState({
        buscar: '',
        tipo: '',
        fecha: new Date().toISOString().split('T')[0]
    });

    const cargarDatos = async () => {
        try {
            setLoading(true);
            // Enviamos los filtros al backend
            const data = await obtenerOperacionesDiariasApi({ ...filtros });
            setRegistros(data.data || []);
        } catch (error) {
            console.error("Error cargando operaciones:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, [filtros.tipo, filtros.fecha]);

    const cerrarModal = (recargar = false) => {
        setCreando(null);
        if (recargar) cargarDatos();
    };

    const toggleStrip = (id: number) => {
        setStripExpandida(stripExpandida === id ? null : id);
    };

    const obtenerEtiquetaTurno = (fecha: string, hora: string) => {
        const h = parseInt(hora.split(':')[0], 10);
        if (h < 8) {
            const d = new Date(fecha + 'T12:00:00');
            d.setDate(d.getDate() - 1);
            return d.toISOString().split('T')[0];
        }
        return fecha;
    };

    return (
        <div className="bg-[#f3f4f6] min-h-screen p-4 font-sans text-slate-900 relative">
            {creando && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => cerrarModal(false)}></div>
                    <div className="relative z-10 w-full max-w-lg">
                        {creando === 'llegada' ? (
                            <FormLlegada moduloNombre={moduloNombre} alCerrar={() => cerrarModal(true)} />
                        ) : (
                            <FormSalida moduloNombre={moduloNombre} alCerrar={() => cerrarModal(true)} />
                        )}
                    </div>
                </div>
            )}
            <div className="max-w-6xl mx-auto mb-6 space-y-4">
                <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-black text-slate-800 uppercase">Operaciones</h1>
                        <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">{moduloNombre}</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setCreando('llegada')} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded transition-colors">+ LLEGADA</button>
                        <button onClick={() => setCreando('salida')} className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-4 py-2 rounded transition-colors">+ SALIDA</button>
                    </div>
                </div>

                <form className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm"
                      onSubmit={(e) => { e.preventDefault(); cargarDatos(); }}>
                    <input
                        type="text"
                        placeholder="Matrícula..."
                        className="text-sm border p-2 rounded outline-blue-500 uppercase"
                        value={filtros.buscar}
                        onChange={(e) => setFiltros({...filtros, buscar: e.target.value.toUpperCase()})}
                    />
                    <select
                        className="text-sm border p-2 rounded outline-blue-500"
                        value={filtros.tipo}
                        onChange={(e) => setFiltros({...filtros, tipo: e.target.value})}
                    >
                        <option value="">Todos los tipos</option>
                        <option value="llegada">Solo Llegadas</option>
                        <option value="salida">Solo Salidas</option>
                    </select>
                    <input
                        type="date"
                        className="text-sm border p-2 rounded outline-blue-500"
                        value={filtros.fecha}
                        onChange={(e) => setFiltros({...filtros, fecha: e.target.value})}
                    />
                    <button type="submit" className="bg-slate-800 text-white text-xs font-bold rounded hover:bg-slate-700 transition-colors">BUSCAR</button>
                </form>
            </div>
            <div className="max-w-6xl mx-auto space-y-2">
                {loading ? (
                    <div className="text-center py-10 text-slate-400 font-bold">Cargando operaciones...</div>
                ) : registros.map((op, index) => {
                    const turnoActual = obtenerEtiquetaTurno(op.fecha, op.hora);
                    const turnoAnterior = index > 0 ? obtenerEtiquetaTurno(registros[index-1].fecha, registros[index-1].hora) : null;
                    const mostrarSeparador = turnoActual !== turnoAnterior;
                    const h = parseInt(op.hora.substring(0, 2), 10);
                    const esMadrugada = h < 8;

                    return (
                        <React.Fragment key={op.id}>
                            {mostrarSeparador && (
                                <div className="flex items-center gap-4 my-6">
                                    <div className="h-[1px] flex-1 bg-slate-300"></div>
                                    <div className="flex flex-col items-center">
                                        <span className="bg-slate-800 text-white text-[10px] font-black px-4 py-1 rounded-full shadow-sm uppercase tracking-tighter">
                                            Turno Operativo: {turnoActual}
                                        </span>
                                        <span className="text-[9px] text-slate-400 font-bold mt-1 uppercase">08:00 HRS - 07:59 HRS</span>
                                    </div>
                                    <div className="h-[1px] flex-1 bg-slate-300"></div>
                                </div>
                            )}

                            <div className={`transition-all duration-300 ${stripExpandida === op.id ? 'ring-2 ring-blue-500 my-4 shadow-lg' : 'hover:bg-slate-50'}`}>
                                <div
                                    onClick={() => toggleStrip(op.id)}
                                    className={`grid grid-cols-12 items-center bg-white border border-slate-200 p-4 rounded-lg cursor-pointer shadow-sm ${esMadrugada ? 'border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}`}
                                >
                                    <div className="col-span-1">
                                        <span className={`w-3 h-3 rounded-full block ${op.tipo === 'llegada' ? 'bg-blue-500' : 'bg-orange-500'}`}></span>
                                    </div>
                                    <div className="col-span-2 font-black text-lg uppercase tracking-tight">{op.matricula}</div>
                                    <div className="col-span-2 text-sm text-slate-600 font-medium">{op.equipo}</div>
                                    <div className="col-span-2 flex items-center gap-2 font-mono text-lg font-bold">
                                        {op.hora.substring(0, 5)}
                                        <span className="text-sm">{esMadrugada ? '🌙' : '☀️'}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${op.tipo === 'llegada' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                                            {op.lugar}
                                        </span>
                                    </div>
                                    <div className="col-span-1 text-center font-bold">{op.pax}</div>

                                    <div className="col-span-2 flex justify-end gap-1">
                                        {op.validaciones?.map((v: string) => (
                                            <div key={v} className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[8px] font-black border border-green-200 uppercase">
                                                {v.substring(0, 3)}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {stripExpandida === op.id && (
                                    <div className="bg-white border-x border-b border-slate-200 rounded-b-lg p-6 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="max-w-3xl mx-auto">
                                            {op.tipo === 'llegada' ? (
                                                <FormLlegada
                                                    moduloNombre={moduloNombre}
                                                    alCerrar={() => { setStripExpandida(null); cargarDatos(); }}
                                                    datosEdicion={op}
                                                    soloLectura={op.validaciones?.includes(moduloNombre)}
                                                />
                                            ) : (
                                                <FormSalida
                                                    moduloNombre={moduloNombre}
                                                    alCerrar={() => { setStripExpandida(null); cargarDatos(); }}
                                                    datosEdicion={op}
                                                    soloLectura={op.validaciones?.includes(moduloNombre)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default OperacionesCards;
