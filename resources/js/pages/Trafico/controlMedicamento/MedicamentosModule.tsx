import React, { useState } from 'react';
import { Pill, User, ClipboardCheck, PenTool, Hash, ArrowLeftRight, Save, History } from 'lucide-react';

const MedicamentosModule = () => {
    const [view, setView] = useState<'entrega' | 'inventario'>('entrega');
    const [selectedMed, setSelectedMed] = useState("");

    const medicamentos = [
        "Aspirina", "Ketorolaco", "Genoprazol", "Granedodin", "Picot", "Loratadina",
        "Toallas femeninas", "Protectores diarios", "Cafiaspirina", "Buscapina",
        "Curitas", "Tempra / Paracetamol", "Naproxeno", "Treda", "Pepto Bismol",
        "XL-3 VR", "Agrifen", "Micropore", "Diclofenaco gel", "Microdacyn spray",
        "Ibuprofeno", "Syncol", "Alka Seltzer"
    ];

    return (
        <div className="flex flex-col min-h-screen bg-slate-100 font-sans">
            {/* NAVBAR SIMPLE */}
            <nav className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Pill className="text-blue-600" /> Control Médico
                </h1>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setView('entrega')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${view === 'entrega' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                    >
                        Entregas
                    </button>
                    <button
                        onClick={() => setView('inventario')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${view === 'inventario' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                    >
                        Inventario Inicio/Fin
                    </button>
                </div>
            </nav>

            {view === 'entrega' ? (
                /* VISTA DE ENTREGA (TU DISEÑO ANTERIOR) */
                <div className="flex flex-col lg:flex-row flex-1">
                    <div className="lg:w-2/3 p-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {medicamentos.map((med) => (
                                <button
                                    key={med}
                                    onClick={() => setSelectedMed(med)}
                                    className={`p-4 rounded-2xl border-2 transition-all duration-200 text-left flex flex-col justify-between h-32 ${selectedMed === med ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100" : "border-white bg-white hover:border-slate-300 shadow-sm"
                                        }`}
                                >
                                    <Pill className={`${selectedMed === med ? "text-blue-600" : "text-slate-400"} mb-2`} size={24} />
                                    <span className={`font-semibold text-sm ${selectedMed === med ? "text-blue-700" : "text-slate-700"}`}>{med}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* PANEL DERECHO DE REGISTRO */}
                    <aside className="lg:w-1/3 bg-white p-8 shadow-xl border-l border-slate-200">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><ClipboardCheck className="text-green-500" /> Detalle de Entrega</h2>
                        <div className="space-y-5">
                            <div className="bg-slate-50 p-3 rounded-lg border border-blue-100">
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Medicamento Seleccionado</label>
                                <p className="font-bold text-blue-700">{selectedMed || "Ninguno"}</p>
                            </div>
                            <input type="text" placeholder="Nombre del Paciente" className="w-full border-b-2 p-2 outline-none focus:border-blue-500" />
                            <input type="number" placeholder="Cantidad" className="w-full border-b-2 p-2 outline-none focus:border-blue-500" />
                            <input type="text" placeholder="Entregado por (Firma Staff)" className="w-full border-b-2 p-2 outline-none focus:border-blue-500" />
                            <div className="h-32 bg-slate-50 border-2 border-dashed rounded-xl flex items-center justify-center text-slate-400 text-xs italic">Espacio para Firma</div>
                            <button className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-slate-800 transition">Confirmar Registro</button>
                        </div>
                    </aside>
                </div>
            ) : (
                /* VISTA DE INVENTARIO: INICIO Y FIN */
                <div className="p-6 max-w-6xl mx-auto w-full">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 italic">Auditoría de Stock Diario</h2>
                                <p className="text-sm text-slate-500">Registra el conteo físico matutino y vespertino</p>
                            </div>
                            <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700">
                                <Save size={18} /> Guardar Corte del Día
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                                        <th className="px-6 py-4 font-bold">Medicamento / Insumo</th>
                                        <th className="px-6 py-4 font-bold text-blue-600">Stock Inicial (Mañana)</th>
                                        <th className="px-6 py-4 font-bold text-orange-600">Consumo Sistema</th>
                                        <th className="px-6 py-4 font-bold text-green-600">Stock Final (Noche)</th>
                                        <th className="px-6 py-4 font-bold text-red-600">Diferencia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {medicamentos.map((med, index) => (
                                        <tr key={index} className="hover:bg-slate-50 transition">
                                            <td className="px-6 py-4 font-semibold text-slate-700">{med}</td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="number"
                                                    defaultValue="20"
                                                    className="w-20 bg-blue-50 border border-blue-200 rounded px-2 py-1 text-center font-bold text-blue-700"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="bg-slate-100 px-3 py-1 rounded-full font-medium">5</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    className="w-20 bg-green-50 border border-green-200 rounded px-2 py-1 text-center font-bold text-green-700 outline-none focus:ring-2 focus:ring-green-400"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-slate-400 italic">Pendiente...</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MedicamentosModule;
