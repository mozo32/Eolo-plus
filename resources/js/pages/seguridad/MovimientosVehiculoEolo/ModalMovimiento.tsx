import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Vehiculo } from './types';

interface Props {
    isOpen: boolean;
    vehiculo: Vehiculo | null;
    tipoAccion: 'Salida' | 'Entrada';
    onClose: () => void;
    onSubmit: (formData: FormData) => void;
}

export const ModalMovimiento = ({
    isOpen,
    vehiculo,
    tipoAccion,
    onClose,
    onSubmit
}: Props) => {
    // 1. Estado para bloquear el botón
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !vehiculo) return null;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (isSubmitting) return; // Evitar múltiples envíos

        setIsSubmitting(true);
        const formData = new FormData(e.currentTarget);

        try {
            // Pasamos el formData al padre
            await onSubmit(formData);
        } finally {
            // Nota: El cierre del modal suele resetear este estado,
            // pero lo ponemos en false por si hay un error de validación
            setIsSubmitting(false);
        }
    };

    // 2. Función para forzar mayúsculas visuales y en el valor
    const handleInputUppercase = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.target.value = e.target.value.toUpperCase();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div
                    className={`p-6 flex justify-between items-center text-white ${
                        tipoAccion === 'Salida' ? 'bg-red-600' : 'bg-blue-600'
                    }`}
                >
                    <div>
                        <h3 className="text-xl font-bold italic tracking-tight">
                            REGISTRO DE {tipoAccion.toUpperCase()}
                        </h3>
                        <p className="text-sm opacity-90">{vehiculo.nombre}</p>
                    </div>

                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="hover:bg-white/20 p-1 rounded-full transition-colors disabled:opacity-50"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Formulario */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    {/* Chofer */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                            Nombre del Chofer
                        </label>
                        <input
                            name="chofer"
                            type="text"
                            required
                            placeholder="NOMBRE COMPLETO"
                            onChange={handleInputUppercase}
                            className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                        />
                    </div>

                    {/* Kilometraje / Gasolina */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                Kilometraje
                            </label>
                            <input
                                name="kilometraje"
                                type="number"
                                required
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                Gasolina
                            </label>
                            <select
                                name="gasolina"
                                className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                <option value="1/4">1/4</option>
                                <option value="1/2">1/2</option>
                                <option value="3/4">3/4</option>
                                <option value="LLENO">LLENO</option>
                            </select>
                        </div>
                    </div>

                    {/* Solo Salida */}
                    {tipoAccion === 'Salida' && (
                        <div className="grid grid-cols-2 gap-4 border-t pt-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                    Destino
                                </label>
                                <input
                                    name="destino"
                                    type="text"
                                    required
                                    placeholder="¿A DÓNDE VA?"
                                    onChange={handleInputUppercase}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                    Autorizado por
                                </label>
                                <input
                                    name="autoriza"
                                    type="text"
                                    required
                                    placeholder="JEFE DE ÁREA"
                                    onChange={handleInputUppercase}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                                />
                            </div>
                        </div>
                    )}

                    {/* Acciones */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-gray-500 font-semibold hover:text-gray-700 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`flex-1 px-4 py-3 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 ${
                                isSubmitting
                                ? 'bg-gray-400 cursor-not-allowed'
                                : (tipoAccion === 'Salida' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700 active:scale-95')
                            }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    PROCESANDO...
                                </>
                            ) : (
                                `REGISTRAR ${tipoAccion.toUpperCase()}`
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
