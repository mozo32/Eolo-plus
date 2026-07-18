import React, { useEffect, useState } from 'react';
import { X, Settings, Link } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSend: (prefactura: string) => Promise<boolean>;
    row: any;
}

export default function ModalPrefactura({
    isOpen,
    onClose,
    onSend,
    row
}: Props) {
    const [prefactura, setPrefactura] = useState('');
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setPrefactura(row?.prefactura || '');
        }
    }, [isOpen, row]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (guardando) return;

        try {
            setGuardando(true);

            const guardadoCorrectamente = await onSend(prefactura);

            if (guardadoCorrectamente) {
                setPrefactura('');
                onClose();
            }
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-md scale-100 rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                            <Settings size={24} />
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-slate-900">
                                Vincular a prefactura
                            </h3>

                            <p className="text-xs font-medium text-slate-500">
                                Folio: {row?.folio || row?.id}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={guardando}
                        className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="mb-1 ml-1 block text-sm font-bold text-slate-700">
                            Número de orden de venta
                        </label>

                        <input
                            autoFocus
                            type="number"
                            required
                            min="1"
                            disabled={guardando}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                            placeholder="234"
                            value={prefactura}
                            onChange={(e) => setPrefactura(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={guardando}
                            className="flex-1 rounded-2xl px-4 py-3 font-bold text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            disabled={guardando || !prefactura.trim()}
                            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Link size={18} />

                            <span>
                                {guardando ? 'Guardando...' : 'Guardar'}
                            </span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
