import React, { useState } from 'react';
import { Plus, Plane, MapPin, Clock, Users, ShieldCheck, Info } from 'lucide-react';

const DailyOpsAdvanced = () => {
    const [showModal, setShowModal] = useState(false);
    const [type, setType] = useState<'llegada' | 'salida'>('llegada');

    // Datos estáticos para la tabla
    const operations = [
        { id: 1, tipo: 'Llegada', matricula: 'XA-TJS', equipo: 'B737', hora: '10:45', nodo: 'CUN (Cancún)', pax: 155, status: 'Confirmado' },
        { id: 2, tipo: 'Salida', matricula: 'N500GD', equipo: 'G650', hora: '11:20', nodo: 'DFW (Dallas)', pax: 12, status: 'Pendiente' },
    ];

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
            {/* Header con Acciones */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Bitácora Operativa</h1>
                    <p className="text-slate-400">Control de tráfico diario y sincronización de slots</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => { setType('llegada'); setShowModal(true); }}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-all"
                    >
                        <Plus size={18} /> Registrar Llegada
                    </button>
                    <button
                        onClick={() => { setType('salida'); setShowModal(true); }}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg transition-all"
                    >
                        <Plus size={18} /> Registrar Salida
                    </button>
                </div>
            </div>

            {/* Tabla Principal */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-700/50 text-slate-300 text-sm uppercase tracking-wider">
                            <th className="p-4">Tipo</th>
                            <th className="p-4">Matrícula</th>
                            <th className="p-4">Equipo</th>
                            <th className="p-4">Hora (UTC)</th>
                            <th className="p-4">Origen / Destino</th>
                            <th className="p-4 text-center">Pax</th>
                            <th className="p-4">Sincronización</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {operations.map((op) => (
                            <tr key={op.id} className="hover:bg-slate-700/30 transition-colors group">
                                <td className="p-4">
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${op.tipo === 'Llegada' ? 'bg-blue-900/40 text-blue-400' : 'bg-emerald-900/40 text-emerald-400'}`}>
                                        {op.tipo}
                                    </span>
                                </td>
                                <td className="p-4 font-mono font-medium text-white">{op.matricula}</td>
                                <td className="p-4 text-slate-400">{op.equipo}</td>
                                <td className="p-4">
                                    <div className="flex items-center gap-2">
                                        <Clock size={14} className="text-amber-400" />
                                        <span className="font-bold">{op.hora}</span>
                                    </div>
                                </td>
                                <td className="p-4 text-slate-400">{op.nodo}</td>
                                <td className="p-4 text-center">{op.pax}</td>
                                <td className="p-4">
                                    {op.status === 'Confirmado' ? (
                                        <div className="flex items-center gap-1 text-xs text-cyan-400">
                                            <ShieldCheck size={14} /> Bloqueado por OPS
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-xs text-slate-500 italic">
                                            <Info size={14} /> Editable
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* MODAL DEL FORMULARIO */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white text-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className={`p-6 ${type === 'llegada' ? 'bg-blue-600' : 'bg-emerald-600'} text-white`}>
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <Plane className={type === 'salida' ? 'rotate-45' : 'rotate-180'} />
                                Nuevo Registro de {type === 'llegada' ? 'Llegada' : 'Salida'}
                            </h3>
                            <p className="text-white/80 text-sm">Asegúrese de que la hora coincida con el reporte de Torre.</p>
                        </div>

                        <form className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Matrícula</label>
                                    <input type="text" placeholder="XA-..." className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Equipo</label>
                                    <input type="text" placeholder="Ej. A320" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Hora de Operación</label>
                                <div className="relative">
                                    <input type="time" className="w-full p-2 border rounded-lg bg-amber-50 border-amber-200 focus:ring-2 focus:ring-amber-500 outline-none" />
                                    <div className="absolute right-3 top-2.5 text-amber-600">
                                        <Clock size={18} />
                                    </div>
                                </div>
                                <p className="text-[10px] text-amber-700 mt-1 italic font-medium">Esta hora se compartirá con todos los departamentos.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                                    {type === 'llegada' ? 'Procedencia (Origen)' : 'Destino'}
                                </label>
                                <div className="relative">
                                    <input type="text" className="w-full p-2 pl-8 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Código OACI/IATA" />
                                    <MapPin size={16} className="absolute left-2.5 top-3 text-slate-400" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Pasajeros (Pax)</label>
                                <div className="relative">
                                    <input type="number" className="w-full p-2 pl-8 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
                                    <Users size={16} className="absolute left-2.5 top-3 text-slate-400" />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className={`flex-1 px-4 py-2 rounded-lg font-bold text-white shadow-lg ${type === 'llegada' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                                >
                                    Guardar Registro
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailyOpsAdvanced;
