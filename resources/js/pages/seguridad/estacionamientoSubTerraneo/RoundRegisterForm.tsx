import React, { useState } from 'react';
import { Plus, Trash2, Car, Hash, User, ArrowLeft, ListChecks, Send, Calendar } from 'lucide-react';
import { guardarEstaSubTerraneo } from '@/stores/apiEstacionamientoSubterraneo';
import Swal from 'sweetalert2';
import InputMatricula from '@/pages/InputMatricula';

interface VehicleEntryFormProps {
    onClose?: () => void;
}

interface Vehiculo {
    id: number;
    placas: string;
    vehiculo: string;
    color: string;
    responsable: string;
    matricula: string;
    llaves: string;
}

const RoundRegisterForm: React.FC<VehicleEntryFormProps> = ({ onClose }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [oficial] = useState('Oficial de Turno');

    const [fechaIngreso, setFechaIngreso] = useState(() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });

    const [currentVehicle, setCurrentVehicle] = useState<Vehiculo>({
        id: Date.now(),
        placas: '',
        vehiculo: '',
        color: '',
        responsable: '',
        matricula: '',
        llaves: 'NO'
    });

    const [listaVehiculos, setListaVehiculos] = useState<Vehiculo[]>([]);

    const handleInputChange = (field: keyof Vehiculo, value: string) => {
        setCurrentVehicle({ ...currentVehicle, [field]: value.toUpperCase() });
    };

    const addToList = () => {
        const { placas, vehiculo, color, responsable } = currentVehicle;
        if (!placas || !vehiculo || !color || !responsable) {
            Swal.fire({ icon: "error", title: "Atención", text: "Campos obligatorios incompletos.", confirmButtonColor: '#1e3a8a' });
            return;
        }

        const existePlacas = listaVehiculos.some(v => v.placas.trim().toUpperCase() === placas.trim().toUpperCase());
        if (existePlacas) {
            Swal.fire({ icon: "warning", title: "Placa Duplicada", text: `La placa ${placas} ya está en la lista.`, confirmButtonColor: '#1e3a8a' });
            return;
        }

        setListaVehiculos([currentVehicle, ...listaVehiculos]);
        setCurrentVehicle({ id: Date.now(), placas: '', vehiculo: '', color: '', responsable: '', matricula: '', llaves: 'NO' });
    };

    const removeFromList = (id: number) => {
        setListaVehiculos(listaVehiculos.filter(v => v.id !== id));
    };

    const handleSubmit = async () => {
        if (listaVehiculos.length === 0) {
            Swal.fire("Lista vacía", "Agregue al menos un vehículo", "info");
            return;
        }

        setIsSubmitting(true);
        try {
            await guardarEstaSubTerraneo({
                oficial: oficial,
                fecha_ingreso: fechaIngreso,
                vehiculos: listaVehiculos
            });

            Swal.fire({ icon: "success", title: "Ronda Guardada", text: `Registros guardados con éxito`, timer: 2000, showConfirmButton: false });
            if (onClose) onClose();
        } catch (error: any) {
            Swal.fire("Error", "No se pudo guardar la información", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 animate-in fade-in duration-500">
            <div className="max-w-6xl mx-auto">
                <button onClick={onClose} className="mb-6 flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold transition-colors">
                    <ArrowLeft size={20} /> Volver al panel principal
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden sticky top-8">
                            <header className="bg-blue-900 text-white p-6 flex justify-between items-center">
                                <p className="text-sm opacity-80 font-bold">Datos de la unidad</p>
                                <Car size={28} />
                            </header>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 ml-1">Placas *</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input
                                            value={currentVehicle.placas}
                                            onChange={(e) => handleInputChange('placas', e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="PLACA"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 ml-1">Vehículo / Modelo *</label>
                                    <input
                                        value={currentVehicle.vehiculo}
                                        onChange={(e) => handleInputChange('vehiculo', e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Ej. Nissan Sentra"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 ml-1">Color *</label>
                                        <input
                                            value={currentVehicle.color}
                                            onChange={(e) => handleInputChange('color', e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 ml-1">Llaves</label>
                                        <select
                                            value={currentVehicle.llaves}
                                            onChange={(e) => handleInputChange('llaves', e.target.value)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="NO">NO</option>
                                            <option value="SI">SI</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-slate-400 ml-1">Responsable *</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input
                                            value={currentVehicle.responsable}
                                            onChange={(e) => handleInputChange('responsable', e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Nombre"
                                        />
                                    </div>
                                </div>

                                <InputMatricula
                                    label="Matrícula"
                                    value={currentVehicle.matricula}
                                    onSelect={(m) => handleInputChange("matricula", m.toUpperCase())}
                                />

                                <button
                                    onClick={addToList}
                                    className="w-full py-4 bg-slate-900 hover:bg-blue-600 text-white rounded-2xl font-black tracking-widest text-xs transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus size={20} /> Agregar a la Lista
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col min-h-[600px]">
                            <header className="bg-blue-900 text-white p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight">Vehículos en Lista</h1>
                                    <p className="text-sm opacity-80">{listaVehiculos.length} registros listos</p>
                                </div>
                                <div className="bg-blue-800/50 p-2 px-4 rounded-2xl border border-blue-700 flex items-center gap-3">
                                    <Calendar size={18} className="text-blue-200" />
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-blue-200">Fecha de Ronda</span>
                                        <input
                                            type="date"
                                            value={fechaIngreso}
                                            onChange={(e) => setFechaIngreso(e.target.value)}
                                            className="bg-transparent border-none text-white font-bold outline-none text-sm cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </header>

                            <div className="flex-1 overflow-x-auto p-4">
                                {listaVehiculos.length > 0 ? (
                                    <table className="w-full text-left border-separate border-spacing-y-3">
                                        <thead>
                                            <tr className="text-[10px] font-black text-slate-400 tracking-widest">
                                                <th className="px-4 pb-2">Placa</th>
                                                <th className="px-4 pb-2">Detalles</th>
                                                <th className="px-4 pb-2">Matrícula</th>
                                                <th className="px-4 pb-2 text-center">Llaves</th>
                                                <th className="px-4 pb-2 text-right">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {listaVehiculos.map((v) => (
                                                <tr key={v.id} className="bg-slate-50 hover:bg-blue-50 transition-colors group">
                                                    <td className="px-4 py-4 rounded-l-2xl">
                                                        <span className="font-mono font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                                                            {v.placas}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="font-bold text-slate-700">{v.vehiculo}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold">{v.color} - {v.responsable}</div>
                                                    </td>
                                                    <td className="px-4 py-4 font-medium text-slate-600">
                                                        {v.matricula || '---'}
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full ${v.llaves === 'SI' ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                                                            {v.llaves}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 rounded-r-2xl text-right">
                                                        <button
                                                            onClick={() => removeFromList(v.id)}
                                                            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-300 py-32">
                                        <Car size={64} strokeWidth={1} className="mb-4 opacity-20" />
                                        <p className="font-bold tracking-widest text-sm">Lista vacía</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-8 bg-slate-50 border-t border-slate-100">
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || listaVehiculos.length === 0}
                                    className={`w-full py-5 rounded-[1.5rem] font-black text-white shadow-xl flex items-center justify-center gap-3 transition-all tracking-[0.2em] text-sm ${
                                        isSubmitting || listaVehiculos.length === 0
                                        ? 'bg-slate-300 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-blue-200'
                                    }`}
                                >
                                    {isSubmitting ? 'Guardando...' : 'Guardar Todos los Registros'}
                                    <Send size={20} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RoundRegisterForm;
