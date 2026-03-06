import React, { useState } from 'react';
import { X, Plus, Trash2, CheckCircle2, Car, Hash, User, Key } from 'lucide-react';
import { guardarEstaSubTerraneo } from '@/stores/apiEstacionamientoSubterraneo';
import Swal from 'sweetalert2';

interface VehicleEntryFormProps {
    isOpen?: boolean;
    onClose?: () => void;
}

const RoundRegisterForm: React.FC<VehicleEntryFormProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [oficial] = useState('Oficial de Turno');

    const [vehiculos, setVehiculos] = useState([
        {
            id: Date.now(),
            placas: '',
            vehiculo: '',
            color: '',
            responsable: '',
            matricula: '',
            llaves: 'NO'
        }
    ]);

    const addRow = () => {
        setVehiculos([...vehiculos, {
            id: Date.now(),
            placas: '',
            vehiculo: '',
            color: '',
            responsable: '',
            matricula: '',
            llaves: 'NO'
        }]);
    };

    const removeRow = (id: number) => {
        if (vehiculos.length > 1) {
            setVehiculos(vehiculos.filter(v => v.id !== id));
        }
    };

    const handleChange = (id: number, field: string, value: string) => {
        setVehiculos(vehiculos.map(v => v.id === id ? { ...v, [field]: value.toUpperCase() } : v));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await guardarEstaSubTerraneo({
                oficial: oficial,
                vehiculos: vehiculos
            });

            Swal.fire({
                icon: "success",
                title: "Ronda Guardada",
                text: `Se registraron ${vehiculos.length} vehículos`,
                timer: 2000,
                showConfirmButton: false
            });

            if (onClose) onClose();
        } catch (error: any) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "No se pudo guardar la ronda",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <div className="bg-white w-full max-w-7xl max-h-[95vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col">

                <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-black tracking-tighter">REGISTRO DE RONDA</h2>
                        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Carga masiva de avistamientos</p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/10 p-3 rounded-2xl transition-colors">
                        <X size={28} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="hidden lg:grid grid-cols-12 gap-4 px-4 mb-2">
                            <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase">Placas</div>
                            <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase">Vehículo</div>
                            <div className="col-span-1 text-[10px] font-black text-slate-400 uppercase">Color</div>
                            <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase">Responsable</div>
                            <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase">Matrícula</div>
                            <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase">Llaves</div>
                            <div className="col-span-1"></div>
                        </div>

                        {vehiculos.map((v) => (
                            <div key={v.id} className="group grid grid-cols-1 lg:grid-cols-12 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all">

                                {/* Placas */}
                                <div className="col-span-2 relative">
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        required
                                        placeholder="PLACA"
                                        className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={v.placas}
                                        onChange={(e) => handleChange(v.id, 'placas', e.target.value)}
                                    />
                                </div>

                                {/* Vehiculo */}
                                <div className="col-span-2 relative">
                                    <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        placeholder="Marca/Modelo"
                                        className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={v.vehiculo}
                                        onChange={(e) => handleChange(v.id, 'vehiculo', e.target.value)}
                                    />
                                </div>

                                {/* Color */}
                                <div className="col-span-1">
                                    <input
                                        placeholder="Color"
                                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={v.color}
                                        onChange={(e) => handleChange(v.id, 'color', e.target.value)}
                                    />
                                </div>

                                {/* Responsable */}
                                <div className="col-span-2 relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        placeholder="Conductor"
                                        className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={v.responsable}
                                        onChange={(e) => handleChange(v.id, 'responsable', e.target.value)}
                                    />
                                </div>

                                {/* Matricula */}
                                <div className="col-span-2 relative">
                                    <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        placeholder="ID / Matrícula"
                                        className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={v.matricula}
                                        onChange={(e) => handleChange(v.id, 'matricula', e.target.value)}
                                    />
                                </div>

                                {/* Llaves (Selector) */}
                                <div className="col-span-2 relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <select
                                        className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                        value={v.llaves}
                                        onChange={(e) => handleChange(v.id, 'llaves', e.target.value)}
                                    >
                                        <option value="NO">SIN LLAVES</option>
                                        <option value="SI">CON LLAVES</option>
                                    </select>
                                </div>

                                {/* Acciones */}
                                <div className="col-span-1 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => removeRow(v.id)}
                                        className="w-full flex items-center justify-center bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all p-3"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={addRow}
                            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:bg-slate-50 hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={20} /> AGREGAR OTRO VEHÍCULO
                        </button>
                    </form>
                </div>

                {/* Footer Acciones */}
                <div className="p-8 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-slate-500 font-medium">
                        Total a registrar: <span className="text-blue-600 font-black text-xl">{vehiculos.length}</span> vehículos
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                        <button
                            onClick={onClose}
                            className="flex-1 md:flex-none px-8 py-4 font-bold text-slate-500 hover:bg-slate-200 rounded-2xl transition-all"
                        >
                            CANCELAR
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className={`flex-[2] md:flex-none px-12 py-4 rounded-2xl font-black text-white shadow-xl flex items-center justify-center gap-3 transition-all ${
                                isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-blue-200'
                            }`}
                        >
                            {isSubmitting ? 'GUARDANDO...' : 'FINALIZAR RONDA'} <CheckCircle2 size={22} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoundRegisterForm;
