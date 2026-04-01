import React, { useEffect, useState, useCallback } from 'react';
import { fetchWalkarounds } from '@/stores/apiWalkaround';
import WalkAroundFirmaModal from '../components/walkAround/ItemTable/WalkAroundFirmaModal';
import WalkAroundFilterModal from './WalkAroundFilterModal';

import {
    Search, Loader2, Plane, ChevronLeft,
    ChevronRight, ArrowUpRight,
    ArrowDownLeft, Info, Plus, X, SlidersHorizontal, Edit2,
    Calendar, MapPin, MousePointerClick
} from 'lucide-react';

import WalkAroundFormV2 from './steps/WalkAroundFormV2';
import WalkAroundPdfExporter from '../components/walkAround/ItemTable/WalkAroundPdfExporter';

const TablaWalkAround = () => {
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [firmId, setFirmId] = useState<number | null>(null);
    const [firmOpen, setFirmOpen] = useState(false);
    const [pagination, setPagination] = useState({
        current_page: 1,
        last_page: 1,
        total: 0,
        per_page: 10
    });
    const handleApplyFilters = () => {
        loadData(1);
    };
    const handlePdfDone = useCallback(() => {
        setPdfId(null);
    }, []);
    const [filters, setFilters] = useState({
        q: '',
        fecha_inicio: '',
        fecha_fin: '',
        movimiento: '',
        tipo: ''
    });

    const formatDate = (dateString: string, timeString?: string) => {
        if (!dateString) return { date: '---', time: '---' };

        const date = new Date(dateString);
        const formattedDate = date.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
        const formattedTime = timeString
            ? timeString.substring(0, 5)
            : date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

        return {
            date: formattedDate,
            time: formattedTime
        };
    };
    const loadData = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const response = await fetchWalkarounds({ ...filters, page, per_page: pagination.per_page });
            setData(response.data);
            setPagination({
                current_page: response.current_page,
                last_page: response.last_page,
                total: response.total,
                per_page: response.per_page
            });
        } catch (error) { console.error(error); } finally { setLoading(false); }
    }, [filters, pagination.per_page]);

    useEffect(() => {
        const timeout = setTimeout(() => { if (!showForm) loadData(1); }, 300);
        return () => clearTimeout(timeout);
    }, [filters.q, showForm, loadData]);

    const handleEdit = (id: number) => { setSelectedId(id); setShowForm(true); };
    const handleNew = () => { setSelectedId(null); setShowForm(true); };

    if (showForm) return <WalkAroundFormV2 id={selectedId} onCancel={() => { setShowForm(false); setSelectedId(null); }} />;

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 lg:p-8 font-sans">
            <div className="max-w-[1400px] mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                    <div>

                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Walkaround </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative group flex-1 md:flex-none">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
                            <input
                                name="q"
                                value={filters.q}
                                onChange={(e) => setFilters(prev => ({ ...prev, q: e.target.value }))}
                                placeholder="Buscar matrícula..."
                                className="bg-white border-0 shadow-sm ring-1 ring-slate-200 rounded-2xl py-3 pl-11 pr-4 w-full md:w-72 focus:ring-2 focus:ring-indigo-600 outline-none text-sm transition-all"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilterModal(true)}
                            className="bg-white p-3 rounded-2xl shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-all active:scale-95"
                        >
                            <SlidersHorizontal size={20} className="text-slate-600" />
                        </button>
                        <button
                            onClick={handleNew}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
                        >
                            <Plus size={20} strokeWidth={3} />
                            <span>Nuevo Registro</span>
                        </button>
                    </div>
                </div>
                <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Información Aeronave</th>
                                    <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Movimiento</th>
                                    <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Origen/Destino</th>
                                    <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Fecha y Hora</th>
                                    <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="relative">
                                                    <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                                                    <Plane className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600" size={16} />
                                                </div>
                                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Actualizando flota...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : data.length > 0 ? (
                                    data.map((item: any) => {
                                        const dateInfo = formatDate(item.fecha, item.hora);
                                        return (
                                            <tr key={item.id} className="group hover:bg-slate-50/50 transition-all">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300 bg-gray-50 text-gray-600}`}>
                                                            <Plane size={22} strokeWidth={2.5} />
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-slate-900 text-lg leading-none mb-1 uppercase">{item.matricula}</p>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md uppercase tracking-tight">{item.tipo_aeronave}</span>
                                                                <span className="text-[10px] font-bold text-slate-300">|</span>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{item.tipo}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${item.movimiento === 'entrada'
                                                        ? 'bg-emerald-100/50 text-emerald-700 ring-1 ring-emerald-200'
                                                        : 'bg-orange-100/50 text-orange-700 ring-1 ring-orange-200'
                                                        }`}>
                                                        {item.movimiento === 'entrada' ? <ArrowDownLeft size={14} strokeWidth={3} /> : <ArrowUpRight size={14} strokeWidth={3} />}
                                                        {item.movimiento}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-white transition-colors">
                                                            <MapPin size={16} className="text-slate-400" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-slate-700">
                                                                {item.movimiento === 'entrada' ? item.procedensia : item.destino}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex flex-col items-center justify-center bg-slate-50/50 group-hover:bg-white p-2 rounded-2xl transition-colors border border-transparent group-hover:border-slate-100">

                                                        <span className="text-[9px] font-bold text-slate-400 block lowercase first-letter:uppercase">{new Date(item.fecha).toLocaleDateString()}</span>
                                                        <span className="font-bold text-sm">{item.hora.substring(0, 5)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleEdit(item.id)}
                                                            className="p-2.5 text-slate-400 hover:text-white hover:bg-indigo-600 rounded-xl transition-all shadow-sm hover:shadow-indigo-200 active:scale-90"
                                                            title="Editar inspección"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition-all shadow-sm active:scale-90"
                                                            onClick={() => {
                                                                setFirmId(item.id);
                                                                setFirmOpen(true);
                                                            }}
                                                        >

                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                width="32"
                                                                height="32"
                                                                viewBox="0 0 24 24"
                                                                fill="none"
                                                                stroke="#5856d6"
                                                                stroke-width="1"
                                                                stroke-linecap="round"
                                                                stroke-linejoin="round"
                                                            >
                                                                <path d="M3 17c3.333 -3.333 5 -6 5 -8c0 -3 -1 -3 -2 -3s-2.032 1.085 -2 3c.034 2.048 1.658 4.877 2.5 6c1.5 2 2.5 2.5 3.5 1l2 -3c.333 2.667 1.333 4 3 4c.53 0 2.639 -2 3 -2c.517 0 1.517 .667 3 2" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
                                                            title="Exportar PDF"
                                                            onClick={() => {
                                                                setPdfId(item.id);
                                                            }}
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
                                                                fill="none" stroke="#c0841a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                                <path d="M7 10l5 5 5-5" />
                                                                <path d="M12 15V3" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="py-32 text-center">
                                            <div className="max-w-xs mx-auto flex flex-col items-center">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                                    <Search size={24} className="text-slate-200" />
                                                </div>
                                                <p className="text-slate-900 font-bold mb-1 text-lg">Sin resultados</p>
                                                <p className="text-slate-400 text-sm">No encontramos registros que coincidan con tu búsqueda.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-8 py-6 bg-slate-50/30 flex items-center justify-between border-t border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mostrando</span>
                            <span className="px-3 py-1 bg-white ring-1 ring-slate-200 rounded-lg text-sm font-bold text-slate-900">{data.length}</span>
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">de {pagination.total}</span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => loadData(pagination.current_page - 1)}
                                disabled={pagination.current_page === 1}
                                className="px-4 py-2 bg-white ring-1 ring-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-30 transition-all font-bold text-xs flex items-center gap-2 text-slate-600 shadow-sm"
                            >
                                <ChevronLeft size={16} strokeWidth={3} /> Anterior
                            </button>
                            <button
                                onClick={() => loadData(pagination.current_page + 1)}
                                disabled={pagination.current_page === pagination.last_page}
                                className="px-4 py-2 bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-30 transition-all font-bold text-xs flex items-center gap-2 text-white shadow-lg shadow-indigo-100"
                            >
                                Siguiente <ChevronRight size={16} strokeWidth={3} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <WalkAroundPdfExporter
                id={pdfId}
                onDone={handlePdfDone}
            />
            <WalkAroundFirmaModal
                open={firmOpen}
                id={firmId}
                onClose={() => {
                    setFirmOpen(false);
                    setFirmId(null);
                }}
            />
            <WalkAroundFilterModal
                open={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                filters={filters}
                setFilters={setFilters}
                onApply={handleApplyFilters}
            />
        </div>
    );
};

export default TablaWalkAround;
