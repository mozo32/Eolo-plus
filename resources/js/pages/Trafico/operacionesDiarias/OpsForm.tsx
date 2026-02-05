import React, { useState } from 'react';
import { X, Building2 } from 'lucide-react';

const OpsForm = ({ isOpen, onClose, onSave }: any) => {
  // Estado del formulario
  const [formData, setFormData] = useState({
    matricula: '',
    equipo: '',
    departamento: 'Despacho', // Valor por defecto
    llegada: { hora: '', origen: '', pax: 0, confirmada: true },
    salida: { hora: '', destino: '', pax: 0, confirmada: true }
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden">
        <form onSubmit={handleSubmit}>
          <div className="bg-indigo-700 p-6 text-white flex justify-between items-center">
            <h2 className="text-xl font-bold">Nuevo Registro Operativo</h2>
            <button type="button" onClick={onClose}><X size={24} /></button>
          </div>

          <div className="p-8 space-y-6">
            {/* Departamento que registra */}
            <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
              <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1 mb-2">
                <Building2 size={14} /> Tu Departamento
              </label>
              <select
                className="w-full bg-white border p-2 rounded-lg outline-none font-bold text-indigo-600"
                value={formData.departamento}
                onChange={(e) => setFormData({...formData, departamento: e.target.value})}
              >
                <option value="Operaciones">Operaciones</option>
                <option value="Tráfico">Tráfico</option>
                <option value="Combustible">Combustible</option>
                <option value="Despacho">Despacho</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <input
                placeholder="Matrícula"
                className="border p-3 rounded-xl font-mono font-bold"
                onChange={(e) => setFormData({...formData, matricula: e.target.value.toUpperCase()})}
                required
              />
              <input
                placeholder="Equipo (Ej. A320)"
                className="border p-3 rounded-xl"
                onChange={(e) => setFormData({...formData, equipo: e.target.value.toUpperCase()})}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* LLEGADA */}
              <div className="space-y-3 p-4 bg-blue-50 rounded-2xl">
                <p className="text-xs font-bold text-blue-600 uppercase">Llegada</p>
                <input type="time" className="w-full p-2 rounded-md border"
                  onChange={(e) => setFormData({...formData, llegada: {...formData.llegada, hora: e.target.value}})} />
                <input placeholder="Origen" className="w-full p-2 rounded-md border text-sm"
                  onChange={(e) => setFormData({...formData, llegada: {...formData.llegada, origen: e.target.value.toUpperCase()}})} />
              </div>

              {/* SALIDA */}
              <div className="space-y-3 p-4 bg-emerald-50 rounded-2xl">
                <p className="text-xs font-bold text-emerald-600 uppercase">Salida</p>
                <input type="time" className="w-full p-2 rounded-md border"
                  onChange={(e) => setFormData({...formData, salida: {...formData.salida, hora: e.target.value}})} />
                <input placeholder="Destino" className="w-full p-2 rounded-md border text-sm"
                  onChange={(e) => setFormData({...formData, salida: {...formData.salida, destino: e.target.value.toUpperCase()}})} />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg"
            >
              PUBLICAR OPERACIÓN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OpsForm;
