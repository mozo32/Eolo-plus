import React, { useState } from 'react';

const MedicamentosControl = () => {
    const medicamentos = [
        "Aspirina", "Ketorolaco", "Genoprazol", "Granedodin", "Picot", "Loratadina",
        "Toallas femeninas", "Protectores diarios", "Cafiaspirina", "Buscapina",
        "Curitas", "Tempra / Paracetamol", "Naproxeno", "Treda", "Pepto Bismol",
        "XL-3 VR", "Agrifen", "Micropore", "Diclofenaco gel", "Microdacyn spray",
        "Ibuprofeno", "Syncol", "Alka Seltzer"
    ];

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Control de Entrega de Medicamentos</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nombre del Paciente</label>
                        <input type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border" placeholder="Juan Pérez" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Medicamento</label>
                        <select className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border">
                            {medicamentos.map((m, i) => (
                                <option key={i} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Cantidad Entregada</label>
                        <input type="number" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border" placeholder="1" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Entregado por (Personal)</label>
                        <input type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 border" placeholder="Enf. María López" />
                    </div>
                </div>

                <div className="mt-8 border-2 border-dashed border-gray-200 rounded-lg p-10 text-center">
                    <p className="text-gray-500 mb-2">Espacio para Firma Digital</p>
                    <div className="h-32 bg-gray-100 rounded flex items-center justify-center italic text-gray-400">
                        [ El usuario firma aquí ]
                    </div>
                    <button className="mt-4 text-sm text-blue-600 underline">Limpiar firma</button>
                </div>

                <button className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
                    Registrar Entrega
                </button>
            </div>
        </div>
    );
};

export default MedicamentosControl;
