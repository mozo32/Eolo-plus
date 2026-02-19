import React, { useState, useEffect } from 'react';
import { Search, LogOut, Clock, User, Hash, PenTool, X, PlusCircle, ArrowLeft, Calendar } from 'lucide-react';
import RegistroVisitantesForm from './RegistroVisitantesFrom';
import { listaRegistroVisitantes, guardarSalida } from '@/stores/apiRegistroVisitantes';

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
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [seleccionado, setSeleccionado] = useState<Visitante | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [verFormulario, setVerFormulario] = useState(false);
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchActivos = async () => {
        try {
            const data = await listaRegistroVisitantes(busqueda, fecha);
            setVisitantes(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchActivos();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [busqueda, fecha, verFormulario]);

    const handleFinalizarSalida = async () => {
        if (!seleccionado) return;
        setCargando(true);
        try {
            const datosSalida = {
                fechaSalida: currentTime.toISOString().split('T')[0],
                horaSalida: currentTime.toLocaleTimeString('es-MX', { hour12: false })
            };

            await guardarSalida(seleccionado.id, datosSalida);
            alert('Salida procesada para ' + seleccionado.nombre);
            setSeleccionado(null);
            fetchActivos();
        } catch (error: any) {
            alert(error.message);
        } finally {
            setCargando(false);
        }
    };
    const timeString = currentTime.toLocaleTimeString('es-MX', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center font-sans">
            <div className="max-w-8xl w-full space-y-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase">
                            {verFormulario ? 'Nuevo Registro' : 'Registro de Salida'}
                        </h1>
                        <p className="text-slate-500 font-medium italic">Sistema de Gestión Eolo Plus</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setVerFormulario(!verFormulario)}
                            className={`${verFormulario ? 'bg-slate-200 text-slate-700' : 'bg-blue-600 text-white'} px-6 py-3 rounded-2xl flex items-center gap-2 shadow-lg transition-all active:scale-95 font-bold`}
                        >
                            {verFormulario ? <><ArrowLeft size={20} /> VOLVER</> : <><PlusCircle size={20} /> ENTRADA</>}
                        </button>

                        <div className="bg-orange-100 text-orange-700 px-6 py-3 rounded-2xl flex items-center gap-3 border border-orange-200 shadow-sm">
                            <Clock size={24} className="animate-pulse" />
                            <span className="font-bold text-lg">{timeString}</span>
                        </div>
                    </div>
                </div>

                <hr className="border-slate-200" />

                {verFormulario ? (
                    <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-100">
                        <RegistroVisitantesForm onSuccess={() => setVerFormulario(false)} />
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                                <input
                                    type="text"
                                    placeholder="Nombre o número de gafete..."
                                    className="w-full bg-white border-2 border-slate-100 focus:border-blue-600 rounded-[2rem] py-5 pl-16 pr-8 outline-none shadow-sm text-lg font-semibold transition-all"
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                />
                            </div>
                            <div className="relative">
                                <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="date"
                                    className="bg-white border-2 border-slate-100 focus:border-blue-600 rounded-[2rem] py-5 pl-14 pr-8 outline-none shadow-sm text-lg font-semibold transition-all text-slate-600"
                                    value={fecha}
                                    onChange={(e) => setFecha(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {visitantes.length > 0 ? (
                                visitantes.map((v) => (
                                    <div key={v.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex items-center justify-between group">
                                        <div className="flex items-center gap-6">
                                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600">
                                                <User size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">{v.nombre}</h3>
                                                <div className="flex gap-4 mt-1 font-bold text-slate-400 text-sm">
                                                    <span className="flex items-center gap-1"><Hash size={14} /> {v.gafete}</span>
                                                    <span className="flex items-center gap-1"><Clock size={14} /> Entrada: {v.hora_entrada}</span>
                                                </div>
                                                <p className="text-xs font-black text-blue-600 uppercase mt-2">{v.procedencia}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setSeleccionado(v)} className="bg-slate-900 hover:bg-orange-600 text-white p-4 rounded-2xl transition-all shadow-lg">
                                            <LogOut size={24} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                                    <p className="text-slate-400 font-bold uppercase tracking-widest">No se encontraron visitantes</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {seleccionado && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 shadow-2xl relative">
                            <button onClick={() => setSeleccionado(null)} className="absolute top-8 right-8 text-slate-400"><X size={28} /></button>
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-black text-slate-800 uppercase">Confirmar Salida</h2>
                                <p className="text-slate-500 font-semibold">{seleccionado.nombre}</p>
                            </div>
                            <div className="space-y-4">
                                <div className="w-full h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center group cursor-crosshair">
                                    <PenTool className="text-slate-300 group-hover:text-blue-500 mb-2" />
                                    <span className="text-slate-300 font-bold italic text-sm">Firma aquí</span>
                                </div>
                                <button
                                    onClick={handleFinalizarSalida}
                                    disabled={cargando}
                                    className={`w-full ${cargando ? 'bg-slate-400' : 'bg-orange-600 hover:bg-orange-700'} text-white font-black py-5 rounded-2xl shadow-xl transition-all mt-4`}
                                >
                                    {cargando ? 'PROCESANDO...' : 'FINALIZAR VISITA Y SALIR'}
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
