import React, { useState } from 'react';
import { Clock, Plane, LayoutGrid, List, Plus, ShieldCheck } from 'lucide-react';
import OpsForm from './OpsForm'; // Importamos el formulario

const OpsTimeline = () => {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estado dinámico para las operaciones
  const [operations, setOperations] = useState([
    {
      id: "FL-102",
      matricula: "XA-VVB",
      equipo: "A321",
      departamento: "Operaciones",
      llegada: { hora: "14:20", origen: "MEX", pax: 180, confirmada: true },
      salida: { hora: "15:10", destino: "CUN", pax: 175, confirmada: false }
    }
  ]);

  // Función para agregar el nuevo registro
  const handleAddOperation = (newData: any) => {
    const newEntry = {
      id: `FL-${Math.floor(Math.random() * 1000)}`,
      ...newData
    };
    setOperations([newEntry, ...operations]);
    setIsModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800">Monitor de Giros Operativos</h1>
          <p className="text-slate-500 text-sm">Información sincronizada entre departamentos</p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus size={20} /> Nueva Operación
          </button>

          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border">
            <button onClick={() => setView('grid')} className={`p-2 rounded-lg ${view === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><LayoutGrid size={20}/></button>
            <button onClick={() => setView('list')} className={`p-2 rounded-lg ${view === 'list' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}><List size={20}/></button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {operations.map((op) => (
          <div key={op.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-black text-indigo-600 uppercase">Matrícula</span>
                <div className="text-xl font-black text-slate-800">{op.matricula}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Registrado por</span>
                <div className="text-xs font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">
                   {op.departamento}
                </div>
              </div>
            </div>

            <div className="p-5 space-y-6">
              {/* Bloque de llegada */}
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Plane size={16} className="rotate-180" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1 uppercase">
                    <span>Llegada de {op.llegada.origen}</span>
                    <ShieldCheck size={14} className="text-green-500" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-mono font-black text-slate-800">{op.llegada.hora}</span>
                    <span className="text-xs text-slate-500 italic">Pax: {op.llegada.pax}</span>
                  </div>
                </div>
              </div>

              {/* Bloque de salida */}
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Plane size={16} />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400 mb-1 uppercase">
                    <span>Salida a {op.salida.destino}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-mono font-black text-slate-800">{op.salida.hora || '--:--'}</span>
                    <span className="text-xs text-slate-500 italic">Pax: {op.salida.pax}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <OpsForm
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleAddOperation}
      />
    </div>
  );
};

export default OpsTimeline;
