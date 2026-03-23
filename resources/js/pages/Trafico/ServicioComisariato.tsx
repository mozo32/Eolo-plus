import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import ServicioComisariatoForm from './servicioComisariato/ServicioComisariatoForm';
import UniversalTable from '../UniversalTable';
import { useState, useEffect, useCallback } from 'react';
import { fetchServicioComisariato, fetchShowServicioComisariato, eliminar } from '@/stores/apiServicioComisariato';
import { Search, Plus, ChevronLeft, Edit2, Calendar, CreditCard, Plane } from 'lucide-react';
import PdfComisariato from './servicioComisariato/PdfComisariato';
import Swal from 'sweetalert2';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Servicio Comisariato' }];

export default function ServicioComisariato() {
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [data, setData] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [detalle, setDetalle] = useState<any>(null);
    const [pdfId, setPdfId] = useState<number | null>(null);

    const formatFecha = (fecha?: string | null) => {
        if (!fecha) return "—";
        const [y, m, d] = fecha.split("T")[0].split("-");
        return new Date(Number(y), Number(m) - 1, Number(d))
            .toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "long",
                year: "numeric",
            });
    };
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
                const res = await eliminar(id);
                if (res.ok) {
                    Swal.fire({
                        title: '¡Eliminado!',
                        text: 'El registro ha sido borrado con éxito.',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    cargarDatos();
                } else {
                    throw new Error(res.message || "Error al eliminar");
                }
            } catch (error: any) {
                Swal.fire('Error', error.message || 'No se pudo eliminar el registro', 'error');
            }
        }
    };
    const cargarDatos = async () => {
        try {
            setLoading(true);
            const res = await fetchServicioComisariato({
                page,
                search,
                per_page: 10,
            });
            setData(res.data);
            setMeta(res);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = async (id: number) => {
        try {
            const dat = await fetchShowServicioComisariato(id);
            setDetalle(dat);
            setIsEdit(true);
            setShowForm(true);
        } catch (error) {
            console.error(error);
        }
    };
    const handlePdfDone = useCallback(() => {
        setPdfId(null);
    }, []);
    const columns = [
        {
            header: "ID",
            render: (row: any) => <span className="font-bold text-slate-600">#{row.id}</span>
        },
        {
            header: "Fecha de Entrega",
            render: (row: any) => (
                <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-emerald-500" />
                    <span className="text-sm font-medium text-slate-700">{formatFecha(row.fecha_entrega)}</span>
                </div>
            )
        },
        {
            header: "Catering / Servicio",
            render: (row: any) => (
                <div className="flex flex-col">
                    <span className="font-bold text-slate-700">{row.catering}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider">Servicio de Comisariato</span>
                </div>
            )
        },
        {
            header: "Aeronave",
            render: (row: any) => (
                <div className="flex items-center gap-2">
                    <Plane size={14} className="text-sky-500" />
                    <span className="font-bold text-slate-700">{row.matricula}</span>
                </div>
            )
        },
        {
            header: "Pago",
            render: (row: any) => (
                <div className="flex items-center gap-2">
                    <CreditCard size={14} className="text-slate-400" />
                    <span className="text-sm text-slate-600">{row.forma_pago}</span>
                </div>
            )
        },
        {
            header: "Acciones",
            align: 'right' as const,
            render: (row: any) => (
                <>
                    <button
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-[#00677F] rounded-xl transition-all shadow-sm"
                        onClick={() => handleEdit(row.id)}
                    >
                        <Edit2 size={18} />
                    </button>
                    <button
                        type="button"
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-amber-600 rounded-xl transition-all shadow-sm"
                        title="Exportar PDF"
                        onClick={() => setPdfId(row.id)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <path d="M7 10l5 5 5-5" />
                            <path d="M12 15V3" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-red-600 rounded-xl transition-all shadow-sm"
                        title="Eliminar"
                        onClick={() => handleEliminar(row.id)}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M3 3l18 18" />
                            <path d="M4 7h3m4 0h9" />
                            <path d="M10 11l0 6" />
                            <path d="M14 14l0 3" />
                            <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l.077 -.923" />
                            <path d="M18.384 14.373l.616 -7.373" />
                            <path d="M9 5v-1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
                        </svg>
                    </button>
                </>
            )
        }
    ];

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (!showForm) cargarDatos();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [page, search, showForm]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Servicio Comisariato" />
            <div className="p-6">
                {!showForm ? (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-black tracking-tight text-slate-900">Servicio Comisariato</h2>
                                <p className="text-sm text-slate-500">Gestión de catering y suministros para aeronaves</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00677F] transition-colors" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Buscar matrícula o catering..."
                                        value={search}
                                        onChange={(e) => {
                                            setPage(1);
                                            setSearch(e.target.value);
                                        }}
                                        className="pl-10 pr-4 py-2.5 w-64 rounded-2xl border border-slate-200 bg-white text-sm outline-none focus:ring-4 focus:ring-sky-50 focus:border-[#00677F] transition-all"
                                    />
                                </div>
                                <button
                                    onClick={() => { setIsEdit(false); setShowForm(true); }}
                                    className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95"
                                >
                                    <Plus size={18} strokeWidth={3} />
                                    <span>Nuevo Registro</span>
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
                            emptyMessage="No se encontraron registros de comisariato"
                        />
                    </div>
                ) : (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => {
                                    setShowForm(false);
                                    setIsEdit(false);
                                    setDetalle(null);
                                }}
                                className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm"
                            >
                                <ChevronLeft size={20} strokeWidth={3} />
                            </button>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">
                                    {isEdit ? 'Editar Registro' : 'Nuevo Registro'}
                                </h2>
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Formulario de Servicio Comisariato</p>
                            </div>
                        </div>

                        <div className="mx-auto max-w-5xl">
                            <ServicioComisariatoForm
                                    isEdit={isEdit}
                                    data={detalle}
                                    open={showForm}
                                    onSuccess={() => {
                                        setShowForm(false);
                                        setIsEdit(false);
                                        setDetalle(null);
                                        cargarDatos();
                                    }}
                                />
                        </div>
                    </div>
                )}
            </div>
            <PdfComisariato
                id={pdfId}
                onDone={handlePdfDone}
            />
        </AppLayout>
    );
}
