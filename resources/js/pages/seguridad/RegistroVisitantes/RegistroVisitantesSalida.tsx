import React, { useState, useEffect } from 'react';
import { Search, LogOut, Clock, User, Hash, PenTool, X } from 'lucide-react';
import { listaRegistroVisitantes } from '@/stores/apiRegistroVisitantes';

interface Visitante {
    id: number;
    nombre: string;
    procedencia: string;
    hora_entrada: string;
    gafete: string;
}

const RegistroVisitantesSalida = () => {
    const [visitantes, setVisitantes] = useState<Visitante[]>([]);
    const [busqueda, setBusqueda] = useState('');
    const [seleccionado, setSeleccionado] = useState<Visitante | null>(null);

    useEffect(() => {
        const fetchActivos = async () => {
            const data: Visitante[] = [
                { id: 1, nombre: 'Juan Pérez', procedencia: 'Logística SA', hora_entrada: '08:30', gafete: 'G-102' },
                { id: 2, nombre: 'María García', procedencia: 'Mantenimiento', hora_entrada: '09:15', gafete: 'G-045' },
            ];
            setVisitantes(data);
        };
        fetchActivos();
    }, []);

    const visitantesFiltrados = visitantes.filter(v =>
        v.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        v.gafete.includes(busqueda)
    );

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center font-sans">
            <div className="max-w-4xl w-full space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-slate-800 tracking-tighter">REGISTRO DE SALIDA</h1>
                        <p className="text-slate-500 font-medium">Localiza tu nombre para marcar tu salida.</p>
                    </div>
                    <div className="bg-orange-100 text-orange-700 px-6 py-3 rounded-2xl flex items-center gap-3 border border-orange-200">
                        <Clock size={24} className="animate-pulse" />
                        <span className="font-bold text-lg">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
                <div className="relative group">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={24} />
                    <input
                        type="text"
                        placeholder="Busca por nombre o número de gafete..."
                        className="w-full bg-white border-2 border-slate-100 focus:border-blue-600 rounded-[2rem] py-6 pl-16 pr-8 outline-none shadow-sm text-xl font-semibold transition-all"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {visitantesFiltrados.map((v) => (
                        <div key={v.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex items-center justify-between group">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                    <User size={32} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{v.nombre}</h3>
                                    <div className="flex gap-4 mt-1">
                                        <span className="text-sm font-bold text-slate-400 flex items-center gap-1">
                                            <Hash size={14} /> {v.gafete}
                                        </span>
                                        <span className="text-sm font-bold text-slate-400 flex items-center gap-1">
                                            <Clock size={14} /> Entrada: {v.hora_entrada}
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-blue-600 uppercase mt-2">{v.procedencia}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => setSeleccionado(v)}
                                className="bg-slate-900 hover:bg-orange-600 text-white p-4 rounded-2xl transition-all shadow-lg active:scale-90"
                            >
                                <LogOut size={24} />
                            </button>
                        </div>
                    ))}
                </div>
                {seleccionado && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl relative animate-in zoom-in duration-300">
                            <button onClick={() => setSeleccionado(null)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-800">
                                <X size={28} />
                            </button>

                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-black text-slate-800 uppercase">Confirmar Salida</h2>
                                <p className="text-slate-500 font-semibold">{seleccionado.nombre}</p>
                            </div>

                            <div className="space-y-4">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block text-center">Firma de Salida</label>
                                <div className="w-full h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center group cursor-crosshair">
                                    <PenTool className="text-slate-300 group-hover:text-blue-500 mb-2 transition-colors" />
                                    <span className="text-slate-300 font-bold italic text-sm">Firma aquí</span>
                                </div>

                                <button
                                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-orange-100 transition-all mt-4"
                                    onClick={() => alert('Salida procesada para ' + seleccionado.nombre)}
                                >
                                    FINALIZAR VISITA Y SALIR
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RegistroVisitantesSalida;
