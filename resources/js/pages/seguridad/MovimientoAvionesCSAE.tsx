import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import MovimientoCSAEForm from './MovimientoAvionesCSAE/MovimientoCSAEForm';
import UniversalTable from '../UniversalTable';
import { useState, useEffect, useCallback } from 'react';
import { fetchMovimientoCSAE, fetchShowMovimientoCSAE, eliminar} from '@/stores/apiMovimientoCSAE';
import { Search, Plane, X, Edit2 } from 'lucide-react';
import PdfCsae from './MovimientoAvionesCSAE/PdfCsae';
import Swal from 'sweetalert2';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Movimiento Aviones CSAE' }];

export default function MovimientoAvionesCSAE() {
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [data, setData] = useState<any[]>([]);
    const [openForm, setOpenForm] = useState(false);
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

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const res = await fetchMovimientoCSAE({
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

    const show = async (id: number) => {
        try {
            const dat = await fetchShowMovimientoCSAE(id);
            setDetalle(dat);
            setIsEdit(true);
            setOpenForm(true);
        } catch (error) {
            console.error(error);
        }
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
    const columns = [
        {
            header: "ID",
            render: (row: any) => <span className="font-bold text-slate-600">#{row.id}</span>
        },
        {
            header: "Matrícula",
            render: (row: any) => (
                <div className="flex items-center gap-2">
                    <Plane size={14} className="text-indigo-500" />
                    <span className="font-bold text-slate-700">{row.matricula}</span>
                </div>
            )
        },
        {
            header: "Tipo Aeronave",
            render: (row: any) => <span className="text-sm text-slate-600">{row.tipo_aeronave}</span>
        },
        {
            header: "Entrada",
            render: (row: any) => (
                <span className="text-sm font-medium text-slate-700">{formatFecha(row.fecha_hora_entrada)}</span>
            )
        },
        {
            header: "Salida",
            render: (row: any) => (
                <span className="text-sm font-medium text-slate-700">{formatFecha(row.fecha_hora_salida)}</span>
            )
        },
        {
            header: "Acciones",
            align: 'right' as const,
            render: (row: any) => (
                <>

                    <button
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-indigo-600 rounded-xl transition-all shadow-sm"
                        onClick={() => show(row.id)}
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
            cargarDatos();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [page, search]);
    const handlePdfDone = useCallback(() => {
        setPdfId(null);
    }, []);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Movimiento de Aviones CSAE" />
            <div className="p-6">
                {!openForm ? (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-black tracking-tight text-slate-900">Movimiento de Aeronaves</h2>
                                <p className="text-sm text-slate-500">Gestión de entradas y salidas CSAE</p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Buscar matrícula..."
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
                                    <Plane size={18} strokeWidth={2} />
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
                            emptyMessage="No se encontraron movimientos de aeronaves"
                        />
                    </div>
                ) : (
                    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50/80 backdrop-blur-2xl animate-in fade-in duration-300">
                        <header className="flex items-center justify-between px-8 py-4 border-b border-slate-200 bg-white/50">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black tracking-[0.3em] text-indigo-600 uppercase">Terminal Operativa</span>
                                <h2 className="text-lg font-bold text-slate-800">
                                    {isEdit ? 'Actualización de Manifiesto' : 'Nuevo Registro de Movimiento'}
                                </h2>
                            </div>

                            <button
                                onClick={() => {
                                    setOpenForm(false);
                                    setIsEdit(false);
                                    setDetalle(null);
                                }}
                                className="group flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 text-white hover:bg-red-600 transition-all duration-300"
                            >
                                <span className="text-xs font-bold uppercase tracking-wider">Cancelar</span>
                                <X size={18} className="group-hover:rotate-90 transition-transform" />
                            </button>
                        </header>

                        <main className="flex-1 overflow-y-auto p-8">
                            <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl">
                                <MovimientoCSAEForm
                                    isEdit={isEdit}
                                    data={detalle}
                                    open={openForm}
                                    onSuccess={() => {
                                        setOpenForm(false);
                                        setIsEdit(false);
                                        setDetalle(null);
                                        cargarDatos();
                                    }}
                                />
                            </div>
                        </main>
                    </div>
                )}
            </div>
            <PdfCsae
                id={pdfId}
                onDone={handlePdfDone}
            />
        </AppLayout>
    );
}
