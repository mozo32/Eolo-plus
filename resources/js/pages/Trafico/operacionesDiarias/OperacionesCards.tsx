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

    const [pagina, setPagina] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [filtros, setFiltros] = useState({
        buscar: '',
        tipo: '',
        fecha: new Date().toLocaleDateString('en-CA')
    });

    const obtenerDiaOperativo = (fechaStr: string, horaStr: string) => {
        try {
            if (!fechaStr || !horaStr) return "Fecha no válida";
            const soloFecha = fechaStr.includes('T') ? fechaStr.split('T')[0] : fechaStr;
            const [horas] = horaStr.split(':').map(Number);
            const [year, month, day] = soloFecha.split('-').map(Number);
            const fecha = new Date(year, month - 1, day, 12, 0, 0);

            if (horas < 8) {
                fecha.setDate(fecha.getDate() - 1);
            }

            const y = fecha.getFullYear();
            const m = String(fecha.getMonth() + 1).padStart(2, '0');
            const d = String(fecha.getDate()).padStart(2, '0');

            return `${y}-${m}-${d}`;
        } catch (error) {
            console.error("Error procesando fecha:", fechaStr, horaStr);
            return "Error de fecha";
        }
    };

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const data = await obtenerOperacionesDiariasApi({ ...filtros, page: pagina });
            setRegistros(data.data || []);
            setMeta(data);
        } catch (error) {
            console.error("Error cargando operaciones:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, [pagina, filtros.tipo, filtros.fecha]);

    const cerrarModal = (recargar = false) => {
        setCreando(null);
        if (recargar) cargarDatos();
    };

    const toggleStrip = (id: number) => {
        setStripExpandida(stripExpandida === id ? null : id);
    };

    const manejarBusqueda = (e: React.FormEvent) => {
        e.preventDefault();
        setPagina(1);
        cargarDatos();
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
                        <button onClick={() => setCreando('llegada')} className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded shadow-md hover:bg-blue-700 transition-colors">+ LLEGADA</button>
                        <button onClick={() => setCreando('salida')} className="bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded shadow-md hover:bg-orange-600 transition-colors">+ SALIDA</button>
                    </div>
                </div>

                <form onSubmit={manejarBusqueda} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <input
                        type="text"
                        placeholder="Buscar matrícula..."
                        className="text-sm border border-slate-200 p-2 rounded outline-blue-500"
                        value={filtros.buscar}
                        onChange={(e) => setFiltros({ ...filtros, buscar: e.target.value.toUpperCase() })}
                    />
                    <select
                        className="text-sm border border-slate-200 p-2 rounded outline-blue-500"
                        value={filtros.tipo}
                        onChange={(e) => { setFiltros({ ...filtros, tipo: e.target.value }); setPagina(1); }}
                    >
                        <option value="">Todos los tipos</option>
                        <option value="llegada">Solo Llegadas</option>
                        <option value="salida">Solo Salidas</option>
                    </select>
                    <input
                        type="date"
                        className="text-sm border border-slate-200 p-2 rounded outline-blue-500"
                        value={filtros.fecha}
                        onChange={(e) => { setFiltros({ ...filtros, fecha: e.target.value }); setPagina(1); }}
                    />
                    <button type="submit" className="bg-slate-800 text-white text-xs font-bold rounded hover:bg-slate-700">BUSCAR</button>
                </form>
            </div>

            <div className="max-w-6xl mx-auto space-y-2">
                <div className="grid grid-cols-12 px-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <div className="col-span-1">Estado</div>
                    <div className="col-span-2">Matrícula</div>
                    <div className="col-span-2">Equipo</div>
                    <div className="col-span-2">Hora</div>
                    <div className="col-span-2">Origen/Dest</div>
                    <div className="col-span-1 text-center">Pax</div>
                    <div className="col-span-2 text-right">Validación</div>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-slate-400">Cargando operaciones...</div>
                ) : (
                    registros.map((op, index) => {
                        const fechaSegura = op.fecha || new Date().toLocaleDateString('en-CA');
                        const horaSegura = op.hora || "00:00:00";
                        const diaOperativoActual = obtenerDiaOperativo(fechaSegura, horaSegura);
                        const diaOperativoAnterior = index > 0
                            ? obtenerDiaOperativo(registros[index - 1].fecha || fechaSegura, registros[index - 1].hora || horaSegura)
                            : null;

                        const esNuevoTurno = diaOperativoActual !== diaOperativoAnterior;
                        const esMadrugada = parseInt(op.hora.substring(0, 2)) < 8;

                        return (
                            <React.Fragment key={op.id}>
                                {esNuevoTurno && (
                                    <div className="flex items-center gap-4 py-6">
                                        <div className="h-[2px] flex-grow bg-gradient-to-r from-transparent to-slate-300"></div>
                                        <div className="bg-slate-800 text-white px-4 py-1 rounded-full text-[10px] font-black tracking-tighter uppercase shadow-sm">
                                            Jornada: {diaOperativoActual} (Inicia 08:00 AM)
                                        </div>
                                        <div className="h-[2px] flex-grow bg-gradient-to-l from-transparent to-slate-300"></div>
                                    </div>
                                )}

                                <div className={`transition-all duration-300 ${stripExpandida === op.id ? 'ring-2 ring-blue-500 my-4' : 'hover:bg-slate-50'}`}>
                                    <div
                                        onClick={() => toggleStrip(op.id)}
                                        className={`grid grid-cols-12 items-center border border-slate-200 p-4 rounded-lg cursor-pointer shadow-sm ${esMadrugada ? 'bg-slate-50/80 border-l-4 border-l-slate-400' : 'bg-white'}`}
                                    >
                                        <div className="col-span-1">
                                            <span className={`w-3 h-3 rounded-full block ${op.tipo === 'llegada' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]'}`}></span>
                                        </div>
                                        <div className="col-span-2 font-black text-lg uppercase tracking-tighter">{op.matricula}</div>
                                        <div className="col-span-2 text-sm text-slate-600 font-medium">{op.equipo}</div>
                                        <div className="col-span-2 font-mono text-lg font-bold">
                                            {op.hora.substring(0, 5)}
                                            {esMadrugada && <span className="text-[9px] ml-1 text-slate-400 font-sans">(+1)</span>}
                                        </div>
                                        <div className="col-span-2">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded ${op.tipo === 'llegada' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                                                {op.lugar}
                                            </span>
                                        </div>
                                        <div className="col-span-1 text-center font-bold">{op.pax}</div>

                                        <div className="col-span-2 flex justify-end gap-1">
                                            {op.validaciones?.map((v: string) => (
                                                <div key={v} className="px-2 py-1 rounded bg-green-100 text-green-700 text-[9px] font-black border border-green-200 uppercase">
                                                    {v.substring(0, 4)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {stripExpandida === op.id && (
                                        <div className="bg-white border-x border-b border-slate-200 rounded-b-lg p-6 shadow-inner">
                                            <div className="max-w-3xl mx-auto">
                                                {op.validaciones?.includes(moduloNombre) ? (
                                                    <div className="bg-slate-50 border-2 border-dashed border-green-200 rounded-xl p-8 text-center">
                                                        <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 text-green-600 rounded-full mb-4">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        </div>
                                                        <h3 className="text-lg font-bold text-slate-800">Operación Validada</h3>
                                                        <p className="text-sm text-slate-500 mt-1">
                                                            Confirmado por <span className="font-bold text-slate-700">{moduloNombre}</span>.
                                                        </p>
                                                        <button
                                                            onClick={() => setStripExpandida(null)}
                                                            className="mt-4 text-xs font-bold text-blue-600 hover:underline"
                                                        >
                                                            CERRAR DETALLES
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {op.tipo === 'llegada' ? (
                                                            <FormLlegada
                                                                moduloNombre={moduloNombre}
                                                                alCerrar={() => {
                                                                    setStripExpandida(null);
                                                                    cargarDatos();
                                                                }}
                                                                datosEdicion={op}
                                                            />
                                                        ) : (
                                                            <FormSalida
                                                                moduloNombre={moduloNombre}
                                                                alCerrar={() => {
                                                                    setStripExpandida(null);
                                                                    cargarDatos();
                                                                }}
                                                                datosEdicion={op}
                                                            />
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </React.Fragment>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default OperacionesCards;
