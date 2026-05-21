import React from 'react';
import { X, AlertTriangle, CheckCircle2, Image as ImageIcon } from 'lucide-react';

interface PreviewInspeccionModalProps {
    isOpen: boolean;
    onClose: () => void;
    detalle: {
        id: number;
        fecha: string;
        evidencias?: Array<{
            id: number;
            url: string;
            modulo: 'SHELL' | 'HYDROKIT' | string;
            observacion: string;
            alerta: boolean | number;
        }>;
    } | null;
    formatFecha: (dateString: string) => { fecha: string; hora: string };
}

export default function PreviewInspeccionModal({ isOpen, onClose, detalle, formatFecha }: PreviewInspeccionModalProps) {
    if (!isOpen || !detalle) return null;

    const { fecha, hora } = formatFecha(detalle.fecha);

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-blue-900/20 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            ></div>
            <div className="relative z-10 w-full max-w-4xl bg-white rounded-2xl shadow-xl shadow-blue-100 border border-blue-100 overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-gradient-to-r from-blue-50 to-sky-50/50 px-6 py-4 flex justify-between items-center border-b border-blue-100">
                    <div>
                        <span className="text-[9px] bg-blue-600 text-white font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                            Módulo de Consulta
                        </span>
                        <h3 className="text-sm font-black uppercase text-blue-900 tracking-tight mt-1">
                            Resumen de Inspección #{detalle.id}
                        </h3>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-100/60 px-2.5 py-1 rounded-lg">
                            {fecha} - {hora}
                        </span>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-full bg-white hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors border border-blue-100 shadow-sm"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto bg-slate-50/50 space-y-6">
                    {detalle.evidencias && detalle.evidencias.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {detalle.evidencias.map((ev) => (
                                <div key={ev.id} className="bg-white rounded-2xl border border-blue-50 shadow-sm overflow-hidden flex flex-col justify-between transition-all hover:shadow-md hover:border-blue-100">
                                    <div className="p-3 bg-gradient-to-b from-blue-50/40 to-white border-b border-blue-50 flex items-center justify-between">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded tracking-widest ${
                                            ev.modulo === 'HYDROKIT'
                                                ? 'bg-cyan-50 text-cyan-700 border border-cyan-100'
                                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                                        }`}>
                                            {ev.modulo}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider">
                                            {ev.alerta ? (
                                                <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-rose-100">
                                                    <AlertTriangle size={11} /> ANOMALÍA
                                                </span>
                                            ) : (
                                                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-100">
                                                    <CheckCircle2 size={11} /> CONFORME
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-sky-50/40 h-56 flex items-center justify-center relative p-2 border-b border-blue-50/50">
                                        <img
                                            src={ev.url}
                                            alt={ev.modulo}
                                            className="max-h-full max-w-full object-contain rounded-lg drop-shadow-sm"
                                        />
                                    </div>
                                    <div className="p-3 bg-white">
                                        <p className="text-[9px] font-black text-blue-400 uppercase mb-1 tracking-wider">
                                            Observaciones de Campo
                                        </p>
                                        <p className="text-xs font-bold text-slate-600 uppercase bg-slate-50 p-2 rounded-xl border border-slate-100 min-h-10 leading-relaxed">
                                            {ev.observacion || 'Sin comentarios registrados.'}
                                        </p>
                                    </div>

                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-blue-200">
                            <ImageIcon className="text-blue-200 mx-auto mb-2" size={36} />
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                Esta inspección no cuenta con evidencias fotográficas.
                            </p>
                        </div>
                    )}
                </div>

                <div className="bg-blue-50/40 px-6 py-3 border-t border-blue-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-blue-600 text-white text-[10px] font-black px-6 py-2.5 rounded-xl shadow-md shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest active:scale-95"
                    >
                        Cerrar Vista Previa
                    </button>
                </div>

            </div>
        </div>
    );
}
