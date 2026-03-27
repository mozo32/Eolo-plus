import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Car, Hash, User, ArrowLeft, Send, Calendar, Search, ChevronDown } from 'lucide-react';
import { guardarEstaSubTerraneo, buscarPlacasExistentes, obtenerDetallePorPlaca } from '@/stores/apiEstacionamientoSubterraneo';
import Swal from 'sweetalert2';
import InputMatricula from '@/pages/InputMatricula';

// --- COMPONENTES AUXILIARES FUERA PARA EVITAR PÉRDIDA DE FOCO ---

const SuggestionInput = ({ label, icon: Icon, value, onChange, field, placeholder, suggestions, openDropdown, setOpenDropdown }: any) => (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
        <label className="text-[10px] font-black text-slate-400 ml-1">{label} *</label>
        <div className="relative group">
            {Icon && <Icon className="absolute left-3 top-3 text-slate-400" size={18} />}
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full ${Icon ? 'pl-10' : 'px-4'} pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none`}
                placeholder={placeholder}
            />
            {suggestions.length > 0 && (
                <button
                    type="button"
                    onClick={() => setOpenDropdown(openDropdown === field ? null : field)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-blue-600 transition-colors"
                >
                    <ChevronDown size={18} className={openDropdown === field ? 'rotate-180 transition-transform' : 'transition-transform'} />
                </button>
            )}

            {openDropdown === field && suggestions.length > 0 && (
                <div className="absolute z-[60] w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-40 overflow-y-auto">
                    {Array.from(new Set(suggestions.map((s: any) => s[field]))).map((val: any, i) => (
                        <div
                            key={i}
                            onClick={() => {
                                onChange(val);
                                setOpenDropdown(null);
                            }}
                            className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-none"
                        >
                            {val}
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
);

// --- COMPONENTE PRINCIPAL ---

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
    const [marcaBusqueda, setMarcaBusqueda] = useState('');
    const [modelosDisponibles, setModelosDisponibles] = useState<string[]>([]);
    const [buscandoModelos, setBuscandoModelos] = useState(false);
    const [sugerencias, setSugerencias] = useState<any[]>([]);
    const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
    const [sugerenciasDetalle, setSugerenciasDetalle] = useState<any[]>([]);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const [fechaIngreso, setFechaIngreso] = useState(() => {
        const d = new Date();
        return d.toISOString().split('T')[0];
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

    useEffect(() => {
        const closeMenus = () => setOpenDropdown(null);
        window.addEventListener('click', closeMenus);
        return () => window.removeEventListener('click', closeMenus);
    }, []);

    useEffect(() => {
        const fetchModelos = async () => {
            if (marcaBusqueda.length < 3) {
                setModelosDisponibles([]);
                return;
            }
            setBuscandoModelos(true);
            try {
                const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/getmodelsformake/${marcaBusqueda}?format=json`);
                const data = await response.json();
                if (data.Results) {
                    const lista = data.Results.map((m: any) => m.Model_Name.toUpperCase()).sort();

                    // Mantenemos el modelo actual en la lista si no está presente en los resultados de la API
                    setModelosDisponibles(prev => {
                        const actual = currentVehicle.vehiculo;
                        if (actual && !lista.includes(actual)) {
                            return [actual, ...lista];
                        }
                        return lista;
                    });
                }
            } catch (error) {
                console.error(error);
            } finally {
                setBuscandoModelos(false);
            }
        };

        const timeoutId = setTimeout(fetchModelos, 800);
        return () => clearTimeout(timeoutId);
    }, [marcaBusqueda]);

    useEffect(() => {
        if (currentVehicle.placas.length < 2) {
            setSugerencias([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const docs = await buscarPlacasExistentes(currentVehicle.placas);
                setSugerencias(docs);
            } catch (e) { console.error(e); }
        }, 300);

        return () => clearTimeout(timer);
    }, [currentVehicle.placas]);

    const handleInputChange = (field: keyof Vehiculo, value: string) => {
        setCurrentVehicle(prev => ({ ...prev, [field]: value }));
    };

    const seleccionarPlaca = async (placa: string) => {
        handleInputChange('placas', placa);
        setSugerencias([]);
        setMostrarSugerencias(false);

        try {
            const detalles = await obtenerDetallePorPlaca(placa);
            if (detalles && detalles.length > 0) {
                const primerRegistro = detalles[0];
                const nombreVehiculo = primerRegistro.vehiculo || '';
                const partes = nombreVehiculo.split(' ');

                // Extraer marca y modelo
                const marcaDetectada = (partes[0] || '').toUpperCase();
                const modeloDetectado = partes.slice(1).join(' ').toUpperCase();

                // 1. Actualizamos la marca (esto disparará el useEffect de la API NHTSA)
                setMarcaBusqueda(marcaDetectada);

                // 2. Si el modelo ya existe en el registro, lo agregamos
                // preventivamente a la lista para que el select lo reconozca
                if (modeloDetectado) {
                    setModelosDisponibles(prev =>
                        prev.includes(modeloDetectado) ? prev : [modeloDetectado, ...prev]
                    );
                }

                // 3. Actualizamos el vehículo
                setCurrentVehicle(prev => ({
                    ...prev,
                    vehiculo: modeloDetectado, // Ahora el select encontrará esta opción
                    color: (primerRegistro.color || '').toUpperCase(),
                    responsable: (primerRegistro.responsable || '').toUpperCase(),
                    matricula: (primerRegistro.matricula || '').toUpperCase(),
                }));

                setSugerenciasDetalle(detalles);
                // ... resto del código (Swal, etc)
            }
        } catch (e) {
            console.error(e);
        }
    };

    const addToList = () => {
        const { placas, vehiculo, color, responsable } = currentVehicle;
        if (!placas || !vehiculo || !marcaBusqueda || !color || !responsable) {
            Swal.fire({ icon: "error", title: "Atención", text: "Campos obligatorios incompletos.", confirmButtonColor: '#1e3a8a' });
            return;
        }

        const existePlacas = listaVehiculos.some(v => v.placas.trim().toUpperCase() === placas.trim().toUpperCase());
        if (existePlacas) {
            Swal.fire({ icon: "warning", title: "Placa Duplicada", text: `La placa ${placas} ya está en la lista.`, confirmButtonColor: '#1e3a8a' });
            return;
        }

        const vehiculoCompleto = `${marcaBusqueda} ${vehiculo}`;
        setListaVehiculos([{ ...currentVehicle, vehiculo: vehiculoCompleto }, ...listaVehiculos]);
        setCurrentVehicle({ id: Date.now(), placas: '', vehiculo: '', color: '', responsable: '', matricula: '', llaves: 'NO' });
        setMarcaBusqueda('');
        setSugerenciasDetalle([]);
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
                                {/* PLACA */}
                                <div className="relative">
                                    <label className="text-[10px] font-black text-slate-400 ml-1">Placa *</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input
                                            value={currentVehicle.placas}
                                            onFocus={() => setMostrarSugerencias(true)}
                                            onChange={(e) => handleInputChange('placas', e.target.value.toUpperCase())}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="PLACA"
                                        />
                                    </div>
                                    {mostrarSugerencias && sugerencias.length > 0 && (
                                        <ul className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
                                            {sugerencias.map((s, i) => (
                                                <li
                                                    key={i}
                                                    onClick={() => seleccionarPlaca(s.placas)}
                                                    className="p-3 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-none transition-colors"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <span className="font-black text-blue-600 font-mono text-sm">{s.placas}</span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{s.vehiculo}</span>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                {/* MARCA */}
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 ml-1">Marca *</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                                        <input
                                            value={marcaBusqueda}
                                            onChange={(e) => {
                                                setMarcaBusqueda(e.target.value.toUpperCase());
                                                handleInputChange('vehiculo', '');
                                            }}
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="EJ: TOYOTA"
                                        />
                                    </div>
                                </div>

                                {/* MODELO */}
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 ml-1">Modelo *</label>
                                    <select
                                        disabled={modelosDisponibles.length === 0 || buscandoModelos}
                                        value={currentVehicle.vehiculo}
                                        onChange={(e) => handleInputChange('vehiculo', e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none appearance-none disabled:opacity-50"
                                    >
                                        <option value="">{buscandoModelos ? 'Cargando...' : 'Seleccione Modelo'}</option>
                                        {modelosDisponibles.map((m, i) => (
                                            <option key={i} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* COLOR (NORMAL) */}
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 ml-1">Color *</label>
                                        <input
                                            value={currentVehicle.color}
                                            onChange={(e) => handleInputChange('color', e.target.value.toUpperCase())}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Color"
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

                                {/* RESPONSABLE (CON SUGERENCIAS) */}
                                <SuggestionInput
                                    label="Responsable"
                                    icon={User}
                                    field="responsable"
                                    value={currentVehicle.responsable}
                                    onChange={(val: string) => handleInputChange('responsable', val.toUpperCase())}
                                    placeholder="Nombre"
                                    suggestions={sugerenciasDetalle}
                                    openDropdown={openDropdown}
                                    setOpenDropdown={setOpenDropdown}
                                />

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

                    {/* LADO DERECHO - TABLA */}
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
                                                    <td className="px-4 py-4 text-center">
                                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full ${v.llaves === 'SI' ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                                                            {v.llaves}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 rounded-r-2xl text-right">
                                                        <button onClick={() => removeFromList(v.id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
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
                                    className={`w-full py-5 rounded-[1.5rem] font-black text-white shadow-xl flex items-center justify-center gap-3 transition-all tracking-[0.2em] text-sm ${isSubmitting || listaVehiculos.length === 0
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
