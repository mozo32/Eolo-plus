import React, { useState } from 'react';
import { PlusCircle, X, Fuel } from 'lucide-react';

interface ConceptosSumanProps {
    onAdd: (data: { litros: number; remision: string }) => void;
    onClose: () => void;
}

export const ModalConceptosSuman = ({ onAdd, onClose }: ConceptosSumanProps) => {
    const [litros, setLitros] = useState<number | ''>('');
    const [remision, setRemision] = useState('');

    const handleConfirmar = () => {
        if (!litros || !remision) return;
        onAdd({ litros: Number(litros), remision });
        onClose();
    };

    return (
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border border-gray-200">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-green-700 flex items-center gap-2">
                    <PlusCircle size={20} /> Conceptos que Suman
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-red-500">
                    <X size={24} />
                </button>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        Litros comprados a ASA
                    </label>
                    <div className="relative">
                        <Fuel className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="number"
                            placeholder="0.00"
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                            value={litros}
                            onChange={(e) => setLitros(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                        N. Remisión / Factura
                    </label>
                    <input
                        type="text"
                        placeholder="Ej. ASA-9988"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                        value={remision}
                        onChange={(e) => setRemision(e.target.value)}
                    />
                </div>

                <button
                    onClick={handleConfirmar}
                    disabled={!litros || !remision}
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition disabled:bg-gray-300 mt-4"
                >
                    AGREGAR AL BALANCE
                </button>
            </div>
        </div>
    );
};
