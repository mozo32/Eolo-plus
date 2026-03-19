import { BreadcrumbItem } from '@/types';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import EntregarTurnoAutotanque from './Autotanque/EntregarTurnoAutotanque';
import UniversalTable from '../UniversalTable';
import { Eye, Calendar, Plus, ArrowLeft, Search, X, ChevronLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchAutotanque } from '@/stores/apiAutoTanque';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reporte de Entrega de Turno' },
];

export default function ReporteEntregaTurno() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [openForm, setOpenForm] = useState(false);

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const res = await fetchAutotanque({
                page,
                search,
                date: filterDate,
                per_page: 10
            });


            setData(res.data || []);
            setMeta(res);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            header: "ID",
            render: (row: any) => <span className="font-bold text-slate-900">#{row.id}</span>
        },
        {
            header: "Nombre de quien entrega",
            render: (row: any) => (
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-700">{row.nombre || 'N/A'}</span>
                </div>
            ),
        },
        {
            header: "Fecha de inicio",
            render: (row: any) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                    {row.fecha}
                </span>
            ),
        },
        {
            header: "Diferencia Final",
            render: (row: any) => (
                <span className="text-sm font-mono font-bold text-slate-600">
                    {row.diferenciaFinal} Lts
                </span>
            ),
        },
        {
            header: "Nombre de quien Recibe",
            render: (row: any) => (
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-700">{row.nombreCierre || 'N/A'}</span>
                </div>
            ),
        },
        {
            header: "Fecha de cierre",
            render: (row: any) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                    {row.fechaCierre || 'Pendiente'}
                </span>
            ),
        },
        {
            header: "Acciones",
            align: 'right' as const,
            render: (row: any) => (
                <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shadow-sm">
                    <Eye size={18} />
                </button>
            ),
        },
    ];

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (!openForm) cargarDatos();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [page, search, filterDate, openForm]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Reporte de Entrega de Turno" />

            <div className="p-6">
                {openForm ? (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => setOpenForm(false)}
                                className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm"
                            >
                                <ChevronLeft size={20} strokeWidth={3} />
                            </button>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">Nuevo Reporte</h2>
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Entrega de turno autotanque</p>
                            </div>
                        </div>
                        <EntregarTurnoAutotanque />
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Autotanque</h2>
                                <p className="text-sm text-slate-500 font-medium uppercase">Reporte de entrega de turno.</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative flex items-center">
                                    <Calendar className="absolute left-3 text-slate-400" size={18} />
                                    <input
                                        type="date"
                                        value={filterDate}
                                        onChange={(e) => {
                                            setPage(1);
                                            setFilterDate(e.target.value);
                                        }}
                                        className="pl-10 pr-10 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all text-slate-600 font-bold"
                                    />
                                    {filterDate && (
                                        <button
                                            onClick={() => setFilterDate("")}
                                            className="absolute right-3 text-slate-400 hover:text-red-500"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>

                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre..."
                                        value={search}
                                        onChange={(e) => {
                                            setPage(1);
                                            setSearch(e.target.value);
                                        }}
                                        className="pl-10 pr-4 py-2.5 w-64 rounded-2xl border border-slate-200 bg-white text-sm outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all"
                                    />
                                </div>

                                <button
                                    onClick={() => setOpenForm(true)}
                                    className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95"
                                >
                                    <Plus size={18} strokeWidth={3} />
                                    <span>NUEVO REPORTE</span>
                                </button>
                            </div>
                        </div>

                        <UniversalTable
                            columns={columns}
                            data={data}
                            loading={loading}
                            pagination={{
                                current_page: meta?.current_page || 1,
                                last_page: meta?.last_page || 1,
                                total: meta?.total || 0
                            }}
                            onPageChange={(p) => setPage(p)}
                            emptyMessage="No se encontraron registros"
                            loadingMessage="Consultando remisiones..."
                        />
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
