import React, { useState } from 'react';
import { X, AlertCircle, Plane, Clock, ChevronRight } from 'lucide-react';
import { FormLlegada } from './FormLlegada';
import { FormSalida } from './FormSalida';

interface Props {
    listado: any[];
    onClose: () => void;
    nombreRol?: string;
    moduloNombre?: string;
    onActualizar: () => void;
}

const MatriculasPendientes = ({ listado, onClose, nombreRol, moduloNombre, onActualizar }: Props) => {
    const [editando, setEditando] = useState<any | null>(null);

    return (
        <div className="fixed inset-0 z-[60] flex justify-end overflow-hidden">
            {/* Overlay principal del panel */}
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Panel Lateral */}
            <div className="relative w-full max-w-md bg-slate-50 shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-in-out">
                {/* CABECERA */}
                <div className="p-6 bg-white border-b border-slate-200">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                                <AlertCircle size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800">Pendientes</h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    <p className="text-sm text-slate-500">
                        Tienes <span className="font-semibold text-red-600">{listado.length}</span> operaciones esperando validación hoy.
                    </p>
                </div>

                {/* LISTADO */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {listado.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Plane size={48} className="mb-4 opacity-20" />
                            <p>No hay matrículas pendientes</p>
                        </div>
                    ) : (
                        listado.map((op) => (
                            <div
                                key={op.id}
                                onClick={() => setEditando(op)}
                                className="group bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-red-300 hover:shadow-md transition-all cursor-pointer"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Matrícula</span>
                                        <span className="text-lg font-black text-slate-700 tracking-tight">{op.matricula}</span>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${
                                        op.tipo === 'llegada'
                                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                            : 'bg-sky-100 text-sky-700 border border-sky-200'
                                    }`}>
                                        {op.tipo}
                                    </span>
                                </div>

                                <div className="flex items-center gap-4 text-sm text-slate-600">
                                    <div className="flex items-center gap-1.5">
                                        <Clock size={14} className="text-slate-400" />
                                        <span>{op.hora}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Plane size={14} className="text-slate-400" />
                                        <span className="truncate max-w-[120px]">{op.equipo}</span>
                                    </div>
                                    <div className="ml-auto group-hover:translate-x-1 transition-transform text-red-400 flex items-center gap-1">
                                        <span className="text-[10px] font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">Validar</span>
                                        <ChevronRight size={18} />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 bg-white border-t border-slate-200">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-colors shadow-lg shadow-slate-200"
                    >
                        Entendido
                    </button>
                </div>
            </div>

            {/* MODAL DE FORMULARIO (SUPERPUESTO) */}
            {editando && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl relative">
                        {/* Botón para cerrar el modal del formulario */}
                        <button
                            onClick={() => setEditando(null)}
                            className="absolute top-4 right-4 z-10 p-2 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>

                        {editando.tipo === 'llegada' ? (
                            <FormLlegada
                                nombreRol={nombreRol}
                                moduloNombre={moduloNombre}
                                alCerrar={() => {
                                    setEditando(null);
                                    onActualizar();
                                }}
                                datosEdicion={editando}
                            />
                        ) : (
                            <FormSalida
                                nombreRol={nombreRol}
                                moduloNombre={moduloNombre}
                                alCerrar={() => {
                                    setEditando(null);
                                    onActualizar();
                                }}
                                datosEdicion={editando}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MatriculasPendientes;
