import React from 'react';
import PressureGauge from './PressureGauge';

interface Props {
    data: any;
}

export default function VistaPreviaRemision({ data }: Props) {
    if (!data) return null;

    const valorPresion = Number(data.presionDif) || 0;
    const totalLitros = Number(data.total_litros) || 0;

    return (
        <div className="bg-white p-1 space-y-6 animate-in zoom-in-95 duration-500 font-sans">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                    <span className="bg-slate-900 text-white text-[9px] font-black px-2 py-1 rounded-sm uppercase tracking-widest">
                        Documento Oficial
                    </span>
                    <h2 className="mt-2 text-2xl font-black text-slate-900 tracking-tighter uppercase">
                        Remisión <span className="text-indigo-600">#{data.folio?.split('-')[1]}</span>
                    </h2>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Fecha</p>
                    <p className="text-sm font-black text-slate-900">{data.fecha}</p>
                </div>
            </div>

            {/* Layout Principal */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* COLUMNA IZQUIERDA: Información y Lecturas */}
                <div className="md:col-span-8 space-y-6">

                    {/* Información del Cliente */}
                    <section>
                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-1">Información del Cliente</p>
                        <div className="bg-slate-50 p-3 rounded-lg border-l-4 border-indigo-500">
                            <p className="text-base font-black text-slate-800 uppercase leading-none">{data.cliente}</p>
                            <p className="text-[10px] font-bold text-slate-500 mt-1">{data.tipo_cliente} • {data.forma_pago}</p>
                        </div>
                    </section>

                    {/* Grid de Datos Operativos y Mediciones */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Matrícula */}
                        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Matrícula / Equipo</p>
                            <p className="text-sm font-black text-slate-800 uppercase">{data.matricula} <span className="text-slate-300 mx-1">|</span> {data.aeronave_tipo}</p>
                        </div>
                        {/* Unidad */}
                        <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Unidad / Producto</p>
                            <p className="text-[13px] font-black text-slate-800 uppercase">{data.unidad?.split('·')[1]} <span className="text-slate-300 mx-1">|</span> {data.producto}</p>
                        </div>

                        {/* COLUMNA DE LECTURAS (Vertical) */}
                        <div className="space-y-4">
                            <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl shadow-sm">
                                <p className="text-[9px] font-bold text-indigo-400 uppercase">Lectura Inicial</p>
                                <p className="text-lg font-mono font-black text-indigo-900">
                                    {Number(data.lectura_inicial).toLocaleString('en-US')}
                                </p>
                            </div>
                            <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl shadow-sm">
                                <p className="text-[9px] font-bold text-indigo-400 uppercase">Lectura Final</p>
                                <p className="text-lg font-mono font-black text-indigo-900">
                                    {Number(data.lectura_final).toLocaleString('en-US')}
                                </p>
                            </div>
                        </div>

                        {/* TOTAL SUMINISTRADO (Mismo diseño que lecturas) */}
                        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-lg flex flex-col justify-center">
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Total Suministrado</p>
                            <div className="mt-1">
                                <span className="text-3xl font-black text-white tracking-tighter">
                                    {totalLitros.toLocaleString('en-US')}
                                </span>
                                <span className="text-xs font-bold text-indigo-400 ml-2 uppercase italic">Lts</span>
                            </div>
                            <div className="mt-2 opacity-20 self-end">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                        </div>
                        <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-4 shadow-md">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-700 pb-2">Registro de Tiempo</p>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-bold text-slate-500">LLEGADA</span>
                                <span className="text-xs font-black">{data.hora_llegada}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-bold text-slate-500">INICIO</span>
                                <span className="text-xs font-black">{data.hora_inicial?.substring(0, 5)}</span>
                            </div>
                            <div className="flex justify-between items-center border-t border-slate-800 pt-2">
                                <span className="text-[9px] font-bold text-slate-500">FINAL</span>
                                <span className="text-xs font-black">{data.hora_final}</span>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>

                {/* COLUMNA DERECHA: Tiempos e Instrumentación */}
                <div className="md:col-span-4 space-y-4">
                    {/* Pressure Gauge */}
                    <div className="flex justify-center transform scale-90 origin-top">
                        <PressureGauge
                            value={valorPresion}
                            onChange={() => {}}
                        />
                    </div>
                </div>
            </div>

            {/* Footer y Firmas */}
            <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable:</p>
                    <p className="text-[10px] font-black text-slate-800 uppercase bg-slate-100 px-2 py-1 rounded">{data.operador}</p>
                </div>

                <div className="grid grid-cols-2 gap-8">
                    {data.firmas?.map((firma: any) => (
                        <div key={firma.id} className="space-y-2">
                            <div className="relative h-28 bg-white border-b-2 border-slate-200 flex items-center justify-center p-2">
                                <img
                                    src={`/storage/${firma.path}`}
                                    alt={firma.pivot.tag}
                                    className="max-h-full w-auto object-contain mix-blend-multiply opacity-90"
                                />
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] font-black text-slate-800 uppercase leading-none">{firma.pivot.tag}</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 tracking-tighter">{firma.pivot.rol}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
