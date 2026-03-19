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
    const [creando, setCreando] = useState<'llegada' | 'salida' | null>(null);
    const [editando, setEditando] = useState<any | null>(null);
    const [pagina, setPagina] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [filtros, setFiltros] = useState({
        buscar: '',
        tipo: '',
        fecha: new Date().toLocaleDateString('en-CA')
    });

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const data = await obtenerOperacionesDiariasApi({ ...filtros, page: pagina });
            setRegistros(data.data || []);
            setMeta(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, [pagina, filtros.tipo, filtros.fecha, filtros.buscar]);

    const cerrarFormulario = (recargar = false) => {
        setCreando(null);
        setEditando(null);
        if (recargar) cargarDatos();
    };

    const manejarBusqueda = (e: React.FormEvent) => {
        e.preventDefault();
        setPagina(1);
        cargarDatos();
    };

    const modoFormulario = creando || editando;

    return (
        <div className="bg-[#f3f4f6] min-h-screen p-4 font-sans text-slate-900">
            <div className="max-w-6xl mx-auto mb-6">
                {!modoFormulario ? (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                            <div className="flex items-center gap-4">
                                <h1 className="text-xl font-black text-slate-800 uppercase">Operaciones</h1>
                                <span className="text-sm font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">{moduloNombre}</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setCreando('llegada')} className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded shadow-md hover:bg-blue-700">+ LLEGADA</button>
                                <button onClick={() => setCreando('salida')} className="bg-orange-500 text-white text-xs font-bold px-4 py-2 rounded shadow-md hover:bg-orange-600">+ SALIDA</button>
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

                        <div className="grid grid-cols-12 px-6 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <div className="col-span-1">#</div>
                            <div className="col-span-1">Estado</div>
                            <div className="col-span-2 text-center">Matrícula</div>
                            <div className="col-span-2 text-center">Equipo</div>
                            <div className="col-span-2 text-center">Hora</div>
                            <div className="col-span-2 text-center">Origen/Dest</div>
                            <div className="col-span-1 text-center">Pax</div>
                            <div className="col-span-1 text-right">Acción</div>
                        </div>

                        {loading ? (
                            <div className="text-center py-10 text-slate-400 font-bold animate-pulse">CARGANDO...</div>
                        ) : (
                            registros.map((op, index) => {
                                const indexDescendente = (meta?.total ?? registros.length) - ((pagina - 1) * (meta?.per_page ?? 100)) - index;
                                return (
                                    <div
                                        key={op.id}
                                        className="grid grid-cols-12 items-center border border-slate-200 p-4 rounded-lg shadow-sm bg-white hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="col-span-1 text-xs font-mono text-slate-400">
                                            {String(indexDescendente).padStart(2, '0')}
                                        </div>
                                        <div className="col-span-1">
                                            <span className={`w-3 h-3 rounded-full block ${op.tipo === 'llegada' ? 'bg-blue-500' : 'bg-orange-500'}`}></span>
                                        </div>
                                        <div className="col-span-2 font-black text-lg uppercase text-center">{op.matricula}</div>
                                        <div className="col-span-2 text-sm text-slate-600 font-medium text-center">{op.equipo}</div>
                                        <div className="col-span-2 font-mono text-lg font-bold text-center">{op.hora.substring(0, 5)}</div>
                                        <div className="col-span-2 text-center">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded ${op.tipo === 'llegada' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                                                {op.lugar}
                                            </span>
                                        </div>
                                        <div className="col-span-1 text-center font-bold">{op.pax}</div>
                                        <div className="col-span-1 text-right">
                                            <button
                                                onClick={() => setEditando(op)}
                                                className="text-blue-600 hover:text-blue-800 text-[10px] font-black underline"
                                            >
                                                EDITAR
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                            <button
                                onClick={() => cerrarFormulario()}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {(creando === 'llegada' || editando?.tipo === 'llegada') ? (
                            <FormLlegada
                                moduloNombre={moduloNombre}
                                alCerrar={() => cerrarFormulario(true)}
                                datosEdicion={editando}
                            />
                        ) : (
                            <FormSalida
                                moduloNombre={moduloNombre}
                                alCerrar={() => cerrarFormulario(true)}
                                datosEdicion={editando}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OperacionesCards;
