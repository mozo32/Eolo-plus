import { useEffect, useState, useCallback } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { indexCombustible, apiEliminar} from '@/stores/apiInspeccionCombustible';
import Inspeccion from './Combustible/Inspeccion';
import { fetchInspeccionId } from "@/stores/apiInspeccionCombustible";
import PdfInspeccionCombustible from './Combustible/components/PdfInspeccionCombustible';
import Swal from 'sweetalert2';
import {
    Calendar,
    Image as ImageIcon,
    User,
    Edit2,
    Plus,
    ChevronLeft,
    ChevronRight,
    Loader2,
    X
} from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Inspección de Combustible' },
];

interface InspeccionResumen {
    id: number;
    user_id: number;
    fecha: string;
    imagenes_count: number;
    user?: { name: string };
}

export default function InspeccionCombustible() {
    const [inspecciones, setInspecciones] = useState<InspeccionResumen[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [detalle, setDetalle] = useState<any>(null);
    const [isEdit, setIsEdit] = useState(false);
    const [pagination, setPagination] = useState({
        current_page: 1,
        last_page: 1,
        total: 0
    });

    useEffect(() => {
        loadData(pagination.current_page);
    }, [pagination.current_page]);
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
                const res = await apiEliminar(id);
                if (res.ok) {
                    Swal.fire({
                        title: '¡Eliminado!',
                        text: 'El registro ha sido borrado con éxito.',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false
                    });
                    loadData(1);
                } else {
                    throw new Error(res.message || "Error al eliminar");
                }
            } catch (error: any) {
                Swal.fire('Error', error.message || 'No se pudo eliminar el registro', 'error');
            }
        }
    };
    const loadData = async (page: number) => {
        try {
            setLoading(true);
            const data = await indexCombustible({ page, per_page: 20 });
            setInspecciones(data.data);
            setPagination({
                current_page: data.current_page,
                last_page: data.last_page,
                total: data.total
            });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSuccess = () => {
        setShowForm(false);
        loadData(1);
    };
    const show = async (id: number) => {
        try {
            const dat = await fetchInspeccionId(id);
            setDetalle(dat);
            setIsEdit(true);
            setShowForm(true);
        } catch (error) {
            console.error(error);
        }
    };
    const formatFecha = (dateString: string) => {
        const date = new Date(dateString);

        // Formato para la fecha (ej: 14/04/2026)
        const fecha = new Intl.DateTimeFormat('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(date);

        // Formato para la hora 24h (ej: 14:30)
        const hora = new Intl.DateTimeFormat('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false // <--- Esto fuerza el formato 24h
        }).format(date);

        return { fecha, hora };
    };
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Historial de Inspecciones" />

            <div className="p-6 space-y-6 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                            {showForm
                                ? (isEdit ? 'Editar Captura' : 'Nueva Captura')
                                : 'Control de Combustible'
                            }
                        </h1>
                        <p className="text-slate-500 text-sm">
                            {showForm
                                ? 'Complete las pruebas de Shell e Hydrokit'
                                : 'Registro histórico de pruebas'}
                        </p>
                    </div>

                    <button
                        onClick={() => {
                            setDetalle(null);
                            setIsEdit(false);
                            setShowForm(!showForm)
                        }}
                        className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${showForm
                                ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 shadow-slate-100'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
                            }`}
                    >
                        {showForm ? <X size={20} /> : <Plus size={20} />}
                        {showForm ? 'Cancelar' : 'Nueva Inspección'}
                    </button>
                </div>

                {/* Renderizado Condicional */}
                {showForm ? (
                    <div className="animate-in fade-in zoom-in duration-300">
                        <Inspeccion dataInitial={detalle} onSuccess={handleSaveSuccess} />
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm text-sm">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="font-bold text-slate-700 flex items-center gap-2 uppercase tracking-tighter">
                                <Calendar size={18} className="text-blue-500" />
                                Últimos Registros
                            </h2>
                            <span className="text-xs font-bold px-3 py-1 bg-slate-200 text-slate-600 rounded-full">
                                TOTAL: {pagination.total}
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-400 text-[10px] uppercase tracking-[0.15em] bg-slate-50/50">
                                        <th className="px-6 py-4 font-black">ID</th>
                                        <th className="px-6 py-4 font-black">Fecha y Hora</th>
                                        <th className="px-6 py-4 font-black">Inspector</th>
                                        <th className="px-6 py-4 font-black text-center">Evidencias</th>
                                        <th className="px-6 py-4 font-black text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="py-20 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Loader2 className="animate-spin text-blue-500" size={32} />
                                                    <span className="text-slate-400 font-bold uppercase text-[10px]">Cargando...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : inspecciones.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-20 text-center text-slate-400 font-medium">
                                                No se encontraron registros.
                                            </td>
                                        </tr>
                                    ) : (
                                        inspecciones.map((row) => (
                                            <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="px-6 py-4 font-mono text-xs text-slate-400">#{row.id}</td>
                                                <td className="px-6 py-4">
                                                    <td className="px-6 py-4">
                                                        {(() => {
                                                            const { fecha, hora } = formatFecha(row.fecha);
                                                            return (
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-slate-700">
                                                                        {fecha}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                                                                        {hora} HRS
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </td>
                                                </td>
                                                <td className="px-6 py-4 uppercase text-xs font-bold text-slate-600">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                            <User size={14} />
                                                        </div>
                                                        {row.user?.name || `ID: ${row.user_id}`}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center">
                                                        <span className="flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-lg text-[10px] font-black border border-green-200">
                                                            <ImageIcon size={12} />
                                                            {row.imagenes_count} FOTOS
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => show(row.id)} className="p-2.5 text-slate-400 hover:text-white hover:bg-indigo-600 rounded-xl transition-all shadow-sm" >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button onClick={() => setPdfId(row.id)} className="p-2.5 text-slate-400 hover:text-white hover:bg-amber-600 rounded-xl transition-all shadow-sm">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
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
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Página {pagination.current_page} de {pagination.last_page}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setPagination(prev => ({ ...prev, current_page: prev.current_page - 1 }))}
                                    disabled={pagination.current_page === 1 || loading}
                                    className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-100 transition-all shadow-sm"
                                >
                                    <ChevronLeft size={18} className="text-slate-600" />
                                </button>
                                <button
                                    onClick={() => setPagination(prev => ({ ...prev, current_page: prev.current_page + 1 }))}
                                    disabled={pagination.current_page === pagination.last_page || loading}
                                    className="p-2 rounded-xl border border-slate-200 bg-white disabled:opacity-30 hover:bg-slate-100 transition-all shadow-sm"
                                >
                                    <ChevronRight size={18} className="text-slate-600" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <PdfInspeccionCombustible id={pdfId} onDone={handlePdfDone} />
        </AppLayout>
    );
}
