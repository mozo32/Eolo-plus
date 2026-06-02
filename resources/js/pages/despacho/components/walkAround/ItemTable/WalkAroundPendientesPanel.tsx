import React from 'react';
import { X } from 'lucide-react';

interface PendientesPanelProps {
    open: boolean;
    onClose: () => void;
    pendientes: any[];
    onFirmar: (id: number) => void;
}

const WalkAroundPendientesPanel: React.FC<PendientesPanelProps> = ({
    open,
    onClose,
    pendientes,
    onFirmar,
}) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[80] flex justify-end">
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            ></div>
            <div className="relative w-full max-w-md bg-white h-screen shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tighter text-base">Firmas Pendientes</h3>
                        <p className="text-[10px] text-amber-600 font-bold uppercase">Registros incompletos</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                    {pendientes.length === 0 ? (
                        <p className="text-slate-400 text-center py-10 font-bold text-xs uppercase">
                            ¡Al día! No hay firmas pendientes.
                        </p>
                    ) : (
                        pendientes.map((item) => (
                            <div
                                key={item.id}
                                className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between hover:border-slate-300 transition-all"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-slate-800 tracking-tight uppercase text-sm">
                                            {item.matricula}
                                        </span>
                                        <span
                                            className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${item.movimiento === 'entrada'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-orange-100 text-orange-700'
                                                }`}
                                        >
                                            {item.movimiento}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-medium">
                                        Fecha: {new Date(item.fecha).toLocaleDateString()}
                                    </p>
                                </div>

                                <button
                                    onClick={() => onFirmar(item.id)}
                                    className="bg-indigo-600 text-white text-[10px] font-black px-3 py-2 rounded shadow-sm hover:bg-indigo-700 active:scale-95 transition-all uppercase tracking-wider"
                                >
                                    Firmar
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default WalkAroundPendientesPanel;
