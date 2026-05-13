import { Edit2, Mail, Eye, X, Calendar, ChevronDown } from "lucide-react";

interface TablaProps {
    data: any[];
    loading: boolean;
    pagina: number;
    meta: any;
    setPagina: (p: number) => void;
    mostrarFiltros: boolean;
    filtros: any;
    setFiltros: (f: any) => void;
    limpiarFiltros: () => void;
    setMostrarModalFecha: (v: boolean) => void;
    handleEdit: (row: any) => void;
    handleEye: (row: any) => void;
    setPdfId: (id: number) => void;
    setSelectedRow: (row: any) => void;
    setEmailModalOpen: (v: boolean) => void;
}

export default function RemisionesIndex({
    data, loading, pagina, meta, setPagina, mostrarFiltros,
    filtros, setFiltros, limpiarFiltros, setMostrarModalFecha,
    handleEdit, handleEye, setPdfId, setSelectedRow, setEmailModalOpen
}: TablaProps) {
    return (
        <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-white border-b border-slate-100">
                                <th className="px-4 py-4 text-[9px] font-black uppercase text-slate-400 text-center w-10">#</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Folio</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Matrícula / Destino</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Fecha / Hora</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Cantidad</th>
                                <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Fila de Filtros */}
                            <tr className={`bg-slate-50 border-b border-slate-200 overflow-hidden transition-all duration-300 ${mostrarFiltros ? 'opacity-100' : 'hidden'}`}>
                                <td className="px-2 py-2"></td>
                                <td className="px-2 py-2 text-center">
                                    <div className="flex items-center gap-1 justify-center">
                                        <button onClick={limpiarFiltros} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                                        <input type="text" placeholder="Folio..." className="w-24 text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-blue-400" value={filtros.buscar} onChange={(e) => setFiltros({ ...filtros, buscar: e.target.value })} />
                                    </div>
                                </td>
                                <td className="px-2 py-2">
                                    <input type="text" placeholder="Matrícula..." className="w-full text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-blue-400 uppercase" value={filtros.matricula} onChange={(e) => setFiltros({ ...filtros, matricula: e.target.value.toUpperCase() })} />
                                </td>
                                <td className="px-2 py-2">
                                    <button onClick={() => setMostrarModalFecha(true)} className="w-full flex items-center justify-between text-[10px] border border-slate-200 p-1.5 rounded bg-white hover:border-blue-400 transition-colors shadow-sm">
                                        <div className="flex items-center gap-1 overflow-hidden">
                                            <Calendar size={12} className="text-blue-500 shrink-0" />
                                            <span className="truncate font-bold text-slate-600 uppercase">
                                                {filtros.periodo === 'dia' ? filtros.fechaInicio : filtros.periodo === 'rango' ? `${filtros.fechaInicio} / ${filtros.fechaFin}` : filtros.periodo.toUpperCase()}
                                            </span>
                                        </div>
                                        <ChevronDown size={12} className="text-slate-400" />
                                    </button>
                                </td>
                                <td className="px-2 py-2">
                                    <input type="number" placeholder="Lts..." className="w-full text-[10px] border border-slate-200 p-1 rounded bg-white outline-none focus:border-blue-400 text-center" value={filtros.cantidad} onChange={(e) => setFiltros({ ...filtros, cantidad: e.target.value })} />
                                </td>
                                <td></td>
                            </tr>

                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-20 text-center text-[10px] font-black text-slate-400 uppercase">Cargando datos...</td></tr>
                            ) : (
                                data.map((row, index) => {
                                    const numeroFila = (pagina - 1) * (meta?.per_page || 20) + (index + 1);
                                    return (
                                        <tr key={row.id} className={`border-b border-slate-50 transition-colors ${row.id_turno ? 'bg-emerald-50/40 hover:bg-emerald-100/60 border-l-4 border-l-emerald-500' : 'hover:bg-slate-50/80 border-l-4 border-l-transparent'}`}>
                                            <td className="px-4 py-4 text-center font-bold text-[10px] text-slate-400">{numeroFila}</td>
                                            <td className="px-6 py-4 text-center font-black text-[10px] text-slate-700">
                                                <div className="flex flex-col items-center gap-1">
                                                    {row.folio || `#${row.id}`}
                                                    {row.id_turno && <span className="text-[7px] bg-emerald-600 text-white px-1 rounded-sm tracking-widest">VINCULADO</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-800 uppercase tracking-tighter">{row.matricula || 'N/A'}</span>
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{row.destino || 'S/D'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="text-[10px] font-bold text-slate-400 block">{new Date(row.fecha + 'T00:00:00').toLocaleDateString('es-ES')}</span>
                                                <span className="text-sm font-black text-slate-700">{row.hora_llegada?.substring(0, 5)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="font-mono text-sm font-black text-indigo-600">
                                                    {Number(row.total_litros || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} <small className="text-[9px] text-slate-400">LTS</small>
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => handleEdit(row)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><Edit2 size={16} /></button>
                                                    <button onClick={() => setPdfId(row.id)} className="p-2 text-slate-400 hover:text-amber-600 transition-colors uppercase font-black text-[10px]">PDF</button>
                                                    <button onClick={() => { setSelectedRow(row); setEmailModalOpen(true); }} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"><Mail size={16} /></button>
                                                    <button onClick={() => handleEye(row)} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"><Eye size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Paginación */}
            {meta && meta.last_page > 1 && (
                <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                    <span className="text-[10px] font-black text-slate-500 uppercase">PÁGINA {meta.current_page} DE {meta.last_page}</span>
                    <div className="flex gap-1">
                        <button disabled={pagina === 1} onClick={() => setPagina(pagina - 1)} className="px-3 py-1 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50">ANTERIOR</button>
                        <button disabled={pagina === meta.last_page} onClick={() => setPagina(pagina + 1)} className="px-3 py-1 border border-slate-200 rounded text-[10px] font-black hover:bg-slate-50 disabled:opacity-50">SIGUIENTE</button>
                    </div>
                </div>
            )}
        </div>
    );
}
