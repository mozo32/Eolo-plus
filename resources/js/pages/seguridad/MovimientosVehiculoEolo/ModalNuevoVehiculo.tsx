import React, { useState } from 'react';
import { X, Truck, Loader2 } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
}

export const ModalNuevoVehiculo = ({ isOpen, onClose, onSubmit }: Props) => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);

        const nuevoVehiculo = {
            id: formData.get('id')?.toString().toUpperCase(),
            nombre: formData.get('nombre')?.toString().toUpperCase(),
            estado: 'En Planta'
        };

        try {
            await onSubmit(nuevoVehiculo);
        } finally {
            setIsSubmitting(false);
        }
    };
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.target.value = e.target.value.toUpperCase();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
                <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Truck size={20} />
                        <h3 className="font-bold">Registrar Nuevo Vehículo</h3>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="hover:bg-indigo-500 rounded-full p-1 transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            ID / Económico
                        </label>
                        <input
                            name="id"
                            required
                            placeholder="EJ: 012-P"
                            onChange={handleInputChange}
                            disabled={isSubmitting}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase disabled:bg-gray-100"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Nombre del Vehículo
                        </label>
                        <input
                            name="nombre"
                            required
                            placeholder="EJ: NISSAN PLATAFORMA"
                            onChange={handleInputChange}
                            disabled={isSubmitting}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase disabled:bg-gray-100"
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 py-2 text-gray-600 font-semibold hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`flex-1 py-2 text-white font-semibold rounded-lg transition-all shadow-lg flex items-center justify-center gap-2 ${
                                isSubmitting
                                ? 'bg-indigo-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 active:scale-95'
                            }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Guardando...
                                </>
                            ) : (
                                'Guardar Vehículo'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
