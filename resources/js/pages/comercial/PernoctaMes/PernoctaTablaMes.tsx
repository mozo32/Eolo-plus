import React from "react";
import PernoctaExportButton from "./PernoctaExportButton";

type Row = {
    matricula: string;
    aeronave: string;
    estatus: string;
    categoria: string;
    ubicacion: "H1" | "H2";
    dias: Record<number, 0 | 1>;
};

interface Props {
    mesNombre: string;
    days: number;
    rows: Row[];
}

export default function PernoctaTablaMes({ mesNombre, days, rows }: Props) {
    if (!rows.length) return null;

    return (
        <div className="mb-24 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 px-4 gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <span className="h-[2px] w-6 bg-violet-400 rounded-full"></span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                            Operaciones
                        </span>
                    </div>
                    <h3 className="text-5xl font-extrabold text-slate-800 tracking-tighter">
                        {mesNombre} <span className="text-violet-200 font-light italic">2026</span>
                    </h3>
                </div>

                <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="bg-slate-50 px-5 py-2.5 rounded-xl border border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Flota Total</p>
                        <p className="text-2xl font-semibold text-slate-700 leading-none">{rows.length}</p>
                    </div>
                    <PernoctaExportButton mes={mesNombre} anio="2026" days={days} rows={rows} />
                </div>
            </div>
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-violet-100 to-blue-50 rounded-[2.5rem] blur-xl opacity-50 transition duration-1000"></div>

                <div className="relative bg-white/70 backdrop-blur-md rounded-[2.5rem] border border-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] overflow-hidden">
                    <div className="max-h-[600px] overflow-auto custom-light-scroll">
                        <table className="w-full border-separate border-spacing-0">
                            <thead>
                                <tr>
                                    <th className="sticky top-0 left-0 z-[100] bg-slate-50 px-8 py-8 text-left border-b border-r border-slate-100">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">Aeronave</span>
                                            <span className="text-sm font-black text-slate-700">MATRÍCULA</span>
                                        </div>
                                    </th>
                                    {Array.from({ length: days }, (_, i) => (
                                        <th key={i} className="sticky top-0 z-[80] bg-slate-50/80 backdrop-blur-md px-2 py-8 border-b border-r border-slate-100/50 min-w-[48px]">
                                            <span className="text-xs font-bold text-slate-400">{i + 1}</span>
                                        </th>
                                    ))}

                                    {/* Columna Total (#) */}
                                    <th className="sticky top-0 right-0 z-[100] bg-violet-50 px-6 py-8 border-b border-violet-100">
                                        <span className="text-xs font-black text-violet-500 uppercase">#</span>
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-50">
                                {rows.map((row, idx) => {
                                    const total = Object.values(row.dias).reduce<number>((a, b) => a + b, 0);
                                    return (
                                        <tr key={idx} className="group transition-all hover:bg-violet-50/30">
                                            <td className="sticky left-0 z-30 bg-white group-hover:bg-slate-50/50 px-8 py-6 transition-colors border-r border-slate-100">
                                                <div className="flex flex-col">
                                                    <span className="text-base font-bold text-slate-700 tracking-tight group-hover:text-violet-600 transition-colors">
                                                        {row.matricula}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                        {row.categoria}
                                                    </span>
                                                </div>
                                            </td>
                                            {Array.from({ length: days }, (_, d) => {
                                                const isActive = row.dias[d + 1] === 1;
                                                return (
                                                    <td key={d} className="p-0 border-r border-slate-50/50 transition-all">
                                                        <div className="flex items-center justify-center h-16 w-full group/cell">
                                                            {isActive ? (
                                                                <div className="relative">
                                                                    <div className="w-6 h-6 bg-white border-2 border-violet-400 rounded-lg rotate-12 group-hover/cell:rotate-[30deg] group-hover/cell:bg-violet-500 group-hover/cell:border-violet-500 transition-all duration-300 shadow-sm flex items-center justify-center">
                                                                        <div className="w-1.5 h-1.5 bg-violet-400 group-hover/cell:bg-white rounded-full transition-colors" />
                                                                    </div>
                                                                    <div className="absolute -inset-1 bg-violet-200 rounded-lg blur opacity-20" />
                                                                </div>
                                                            ) : (
                                                                <div className="w-1 h-1 bg-slate-200 rounded-full group-hover:bg-slate-300 transition-all" />
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="sticky right-0 z-30 bg-white group-hover:bg-violet-50/50 px-6 py-6 border-l border-slate-100 shadow-[-4px_0_12px_rgba(0,0,0,0.02)]">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-lg font-bold text-slate-700">{total}</span>
                                                    <div className="h-0.5 w-4 bg-violet-200 rounded-full" />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div className="mt-8 flex justify-center gap-12 px-6">
                <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 bg-white border-2 border-violet-400 rounded rotate-12 flex items-center justify-center">
                        <div className="w-1 h-1 bg-violet-400 rounded-full" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pernocta Registrada</span>
                </div>
                <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin Actividad</span>
                </div>
            </div>
        </div>
    );
}
