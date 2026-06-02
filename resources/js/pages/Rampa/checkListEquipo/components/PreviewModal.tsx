import React from "react";
import { X, ShieldCheck, XCircle } from "lucide-react";

interface PreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    previewData: any;
}

export default function PreviewModal({ isOpen, onClose, previewData }: PreviewModalProps) {
    if (!isOpen || !previewData) return null;

    // Helper interno para extraer los insumos de seguridad indexados por el mes
    const getPreviewItems = () => {
        if (!previewData?.checklist) return [];
        const meses = Object.keys(previewData.checklist);
        if (meses.length === 0) return [];
        return Object.entries(previewData.checklist[meses[0]]);
    };

    return (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
            {/* Backdrop con desenfoque */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            ></div>

            {/* Contenedor del Modal */}
            <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">

                {/* Cabecera del modal */}
                <div className="bg-blue-900 text-white px-6 py-4 flex justify-between items-center border-b border-slate-800">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-tight">Vista Previa Digital</h3>
                        <p className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Folio #{previewData.id} · EOLO PLUS</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Contenido Scrolleable */}
                <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar bg-slate-50/50 flex-1">

                    {/* Bloque de Información del Trabajador */}
                    <div className="grid grid-cols-2 border border-slate-300 rounded-xl bg-white overflow-hidden text-[11px]">
                        <div className="p-3 border-r border-slate-200">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Empleado</span>
                            <span className="font-black text-slate-800 uppercase">{previewData.nombre}</span>
                        </div>
                        <div className="p-3">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Fecha Auditoría</span>
                            <span className="font-bold text-slate-700">
                                {previewData.created_at ? new Date(previewData.created_at).toLocaleString('es-MX') : 'N/A'}
                            </span>
                        </div>
                    </div>

                    {/* Rejilla/Tabla del Estado de Insumos */}
                    <div className="border border-slate-300 rounded-xl bg-white overflow-hidden shadow-xs">
                        <div className="grid grid-cols-3 bg-slate-100 border-b border-slate-300 font-black text-[9px] uppercase tracking-wider text-slate-500 p-2.5">
                            <div className="col-span-1">Insumo</div>
                            <div className="text-center">Asignación</div>
                            <div className="text-right">Condición</div>
                        </div>

                        <div className="divide-y divide-slate-200">
                            {getPreviewItems().map(([key, item]: [string, any]) => (
                                <div key={key} className="grid grid-cols-3 p-2.5 items-center text-xs text-slate-700">
                                    <div className="font-black text-slate-800 uppercase text-[10px] truncate">{key}</div>
                                    <div className="text-center">
                                        {item.tiene ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                                <ShieldCheck size={12} /> PORTA
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                                                <XCircle size={12} /> NO PORTA
                                            </span>
                                        )}
                                    </div>
                                    <div className={`text-right font-bold text-[11px] ${item.estado === 'Mal Estado' ? 'text-red-500' : 'text-slate-600'}`}>
                                        {item.tiene ? (item.estado || 'Buen Estado') : '—'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Cuadro de Observaciones */}
                    <div className="border border-slate-300 rounded-xl bg-white p-4">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">Hallazgos Especiales</span>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                            {previewData.observaciones || "No se reportaron anomalías ni faltantes de equipo de protección personal durante esta auditoría mensual."}
                        </p>
                    </div>
                </div>

                {/* Footer del modal */}
                <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black px-4 py-2 rounded shadow-sm uppercase tracking-wider active:scale-95 transition-all"
                    >
                        Cerrar Vista
                    </button>
                </div>
            </div>
        </div>
    );
}
