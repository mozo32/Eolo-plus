import React, { useState } from 'react';
import { PlaneTakeoff, PlaneLanding, Clock, Users, MapPin, Hash } from 'lucide-react';

// Datos estáticos de ejemplo
const INITIAL_ARRIVALS = [
  { id: 1, matricula: 'XA-VAB', equipo: 'A320', hora: '08:30', procedencia: 'MMMX', pax: 142, bloqueado: true },
  { id: 2, matricula: 'N12345', equipo: 'G550', hora: '--:--', procedencia: 'KLAX', pax: 8, bloqueado: false },
];

const INITIAL_DEPARTURES = [
  { id: 1, matricula: 'XB-RTZ', equipo: 'C172', hora: '09:15', destino: 'MMGL', pax: 3, bloqueado: true },
  { id: 2, matricula: 'XA-LMN', equipo: 'B738', hora: '--:--', destino: 'MMMY', pax: 160, bloqueado: false },
];

const DailyOps = () => {
  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Panel de Operaciones Diarias</h1>
        <p className="text-slate-500">Sincronización interdepartamental en tiempo real</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* SECCIÓN LLEGADAS */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-blue-600 p-4 flex items-center gap-2 text-white">
            <PlaneLanding size={20} />
            <h2 className="font-semibold">Llegadas (Arrivals)</h2>
          </div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <tr>
                <th className="p-4 font-medium italic"><Hash size={14} className="inline mr-1"/> Matrícula</th>
                <th className="p-4 font-medium">Equipo</th>
                <th className="p-4 font-medium"><Clock size={14} className="inline mr-1"/> Hora</th>
                <th className="p-4 font-medium"><MapPin size={14} className="inline mr-1"/> Procedencia</th>
                <th className="p-4 font-medium"><Users size={14} className="inline mr-1"/> Pax</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {INITIAL_ARRIVALS.map((flight) => (
                <tr key={flight.id} className="hover:bg-blue-50/30 transition-colors">
                  <td className="p-4 font-bold text-blue-700">{flight.matricula}</td>
                  <td className="p-4 text-slate-600">{flight.equipo}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-sm ${flight.bloqueado ? 'bg-green-100 text-green-700 font-mono' : 'bg-amber-100 text-amber-700 animate-pulse'}`}>
                      {flight.hora}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600">{flight.procedencia}</td>
                  <td className="p-4 text-slate-600">{flight.pax}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* SECCIÓN SALIDAS */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-emerald-600 p-4 flex items-center gap-2 text-white">
            <PlaneTakeoff size={20} />
            <h2 className="font-semibold">Salidas (Departures)</h2>
          </div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-sm">
              <tr>
                <th className="p-4 font-medium italic"><Hash size={14} className="inline mr-1"/> Matrícula</th>
                <th className="p-4 font-medium">Equipo</th>
                <th className="p-4 font-medium"><Clock size={14} className="inline mr-1"/> Hora</th>
                <th className="p-4 font-medium"><MapPin size={14} className="inline mr-1"/> Destino</th>
                <th className="p-4 font-medium"><Users size={14} className="inline mr-1"/> Pax</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {INITIAL_DEPARTURES.map((flight) => (
                <tr key={flight.id} className="hover:bg-emerald-50/30 transition-colors">
                  <td className="p-4 font-bold text-emerald-700">{flight.matricula}</td>
                  <td className="p-4 text-slate-600">{flight.equipo}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-sm ${flight.bloqueado ? 'bg-green-100 text-green-700 font-mono' : 'bg-amber-100 text-amber-700'}`}>
                      {flight.hora}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600">{flight.destino}</td>
                  <td className="p-4 text-slate-600">{flight.pax}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

      </div>

      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
        <strong>Nota de sistema:</strong> Las horas marcadas en verde han sido validadas por Operaciones/Torre y no pueden ser modificadas por otros departamentos.
      </div>
    </div>
  );
};

export default DailyOps;
