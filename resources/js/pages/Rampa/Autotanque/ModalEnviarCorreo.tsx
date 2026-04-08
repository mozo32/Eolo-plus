import React, { useState } from 'react';
import { X, Send, Mail } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSend: (email: string) => void;
    row: any; // Información de la remisión
}

export default function ModalEnviarCorreo({ isOpen, onClose, onSend, row }: Props) {
    const [email, setEmail] = useState(row?.cliente_email || ''); // Prellenar si existe

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSend(email);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-md scale-100 rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Mail size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Enviar Remisión</h3>
                            <p className="text-xs text-slate-500 font-medium">Folio: {row?.folio || row?.id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1 ml-1">
                            Correo Electrónico
                        </label>
                        <input
                            autoFocus
                            type="email"
                            required
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all text-sm"
                            placeholder="ejemplo@correo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 px-4 py-3 rounded-2xl font-bold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95"
                        >
                            <Send size={18} />
                            <span>Enviar</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
