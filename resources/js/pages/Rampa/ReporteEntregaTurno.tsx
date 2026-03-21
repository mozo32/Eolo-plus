import { BreadcrumbItem } from '@/types';
import Swal from 'sweetalert2';
import AppLayout from '@/layouts/app-layout';
import { Head } from '@inertiajs/react';
import EntregarTurnoAutotanque from './Autotanque/EntregarTurnoAutotanque';
import UniversalTable from '../UniversalTable';
import { Calendar, Plus, X, ChevronLeft, Edit2, AlertCircle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { fetchAutotanque, eliminarTurno, showAutotanque, fetchTurnoActivo } from '@/stores/apiAutoTanque';
import PdfExporterAutotanque from './Autotanque/PdfExporterAutotanque';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Reporte de Entrega de Turno' }];

export default function ReporteEntregaTurno() {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [openForm, setOpenForm] = useState(false);
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [detalle, setDetalle] = useState<any>(null);
    const [turnoPendiente, setTurnoPendiente] = useState<any>(null);

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

    const verificarTurnoActivo = async () => {
        try {
            const res = await fetchTurnoActivo();
            if (res?.active) {
                setTurnoPendiente(res.data);
            } else {
                setTurnoPendiente(null);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleAccionReporte = () => {
        if (turnoPendiente) {
            setDetalle(turnoPendiente);
        } else {
            setDetalle(null);
        }
        setOpenForm(true);
    };

    const handlePdfDone = useCallback(() => setPdfId(null), []);

    const handleEliminar = async (id: number) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: "El registro se marcará como inactivo.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#f87171',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true
        });

        if (result.isConfirmed) {
            try {
                const res = await eliminarTurno(id);
                if (res.ok) {
                    Swal.fire({ title: '¡Eliminado!', icon: 'success', timer: 1500, showConfirmButton: false });
                    cargarDatos();
                    verificarTurnoActivo();
                } else {
                    throw new Error(res.message || "Error al eliminar");
                }
            } catch (error: any) {
                Swal.fire('Error', error.message || 'No se pudo eliminar', 'error');
            }
        }
    };

    const show = async (id: number) => {
        try {
            const dat = await showAutotanque(id);
            setDetalle(dat);
            setOpenForm(true);
        } catch (error) {
            console.error(error);
        }
    };

    const columns = [
        { header: "ID", render: (row: any) => <span className="font-bold text-slate-900">#{row.id}</span> },
        { header: "Nombre de quien entrega", render: (row: any) => <span className="text-sm font-semibold text-slate-700">{row.nombre || 'N/A'}</span> },
        { header: "Fecha de inicio", render: (row: any) => <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{row.fecha}</span> },
        { header: "Diferencia Final", render: (row: any) => <span className="text-sm font-mono font-bold text-slate-600">{row.diferenciaFinal} Lts</span> },
        { header: "Nombre de quien Recibe", render: (row: any) => <span className="text-sm font-semibold text-slate-700">{row.nombreCierre || 'N/A'}</span> },
        { header: "Fecha de cierre", render: (row: any) => <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">{row.fechaCierre || 'Pendiente'}</span> },
        {
            header: "Acciones",
            align: 'right' as const,
            render: (row: any) => (
                <div className="flex items-center justify-end gap-2">
                    <button className="p-2.5 text-slate-400 hover:text-white hover:bg-indigo-600 rounded-xl transition-all shadow-sm" onClick={() => show(row.id)}>
                        <Edit2 size={18} />
                    </button>
                    <button className="p-2.5 text-slate-400 hover:text-white hover:bg-amber-600 rounded-xl transition-all shadow-sm" onClick={() => setPdfId(row.id)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
                    </button>
                    <button className="p-2.5 text-slate-400 hover:text-white hover:bg-red-600 rounded-xl transition-all shadow-sm" onClick={() => handleEliminar(row.id)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18" /><path d="M4 7h3m4 0h9" /><path d="M10 11l0 6" /><path d="M14 14l0 3" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l.077 -.923" /><path d="M18.384 14.373l.616 -7.373" /><path d="M9 5v-1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
                    </button>
                </div>
            )
        },
    ];

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (!openForm) {
                cargarDatos();
                verificarTurnoActivo();
            }
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
                            <button onClick={() => { setOpenForm(false); setDetalle(null); }} className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm">
                                <ChevronLeft size={20} strokeWidth={3} />
                            </button>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">{detalle ? 'Finalizar Turno' : 'Nuevo Reporte'}</h2>
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                                    {detalle ? `Editando Folio #${detalle.turno?.id || detalle.id}` : 'Entrega de turno autotanque'}
                                </p>
                            </div>
                        </div>
                        <EntregarTurnoAutotanque initialData={detalle} />
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Autotanque</h2>
                                <p className="text-sm text-slate-500 font-medium uppercase">Reporte de entrega de turno.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                {turnoPendiente && (
                                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 px-3 py-2 rounded-xl animate-pulse">
                                        <AlertCircle size={14} className="text-amber-600" />
                                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-tight">Turno abierto detectado</span>
                                    </div>
                                )}
                                <div className="relative flex items-center">
                                    <input type="date" value={filterDate} onChange={(e) => { setPage(1); setFilterDate(e.target.value); }} className="pl-4 pr-10 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all text-slate-600 font-bold" />
                                    {filterDate && <button onClick={() => setFilterDate("")} className="absolute right-3 text-slate-400 hover:text-red-500"><X size={16} /></button>}
                                </div>
                                <button
                                    onClick={handleAccionReporte}
                                    className={`flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white transition-all shadow-lg active:scale-95 ${
                                        turnoPendiente ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'
                                    }`}
                                >
                                    {turnoPendiente ? (
                                        <>
                                            <Edit2 size={18} strokeWidth={3} />
                                            <span>CONTINUAR / CERRAR TURNO</span>
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={18} strokeWidth={3} />
                                            <span>NUEVO REPORTE</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                        <UniversalTable columns={columns} data={data} loading={loading} pagination={{ current_page: meta?.current_page || 1, last_page: meta?.last_page || 1, total: meta?.total || 0 }} onPageChange={(p) => setPage(p)} emptyMessage="No se encontraron registros" />
                    </div>
                )}
            </div>
            <PdfExporterAutotanque id={pdfId} onDone={handlePdfDone} />
        </AppLayout>
    );
}
