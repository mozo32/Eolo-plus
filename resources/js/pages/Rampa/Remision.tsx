import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import EoloForm from './Autotanque/EoloForm';
import UniversalTable from '../UniversalTable';
import { useState, useEffect } from 'react';
import { fetchRemisionesDelDia,fetchRemisionById } from '@/stores/apiAutoTanque';
import { ChevronLeft, Plus, FileText, Calendar, X, Eye } from "lucide-react";

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Remisiones',
    },
];

export default function Remision() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any[]>([]);
    const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [openForm, setOpenForm] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [detalle, setDetalle] = useState<any>(null);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const cargarDatos = async () => {
        try {
            setLoading(true);
            const res = await fetchRemisionesDelDia(filterDate);
            setData(Array.isArray(res) ? res : res.data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = async (row: any) => {
        try {
            setLoadingDetalle(true);
            const datosCompletos = await fetchRemisionById(row.id);

            setDetalle(datosCompletos);
            setIsEdit(true);
            setOpenForm(true);
        } catch (error) {
            console.error("Error al obtener detalle:", error);
            alert("No se pudo cargar la información detallada de la remisión.");
        } finally {
            setLoadingDetalle(false);
        }
    };

    const handleBack = () => {
        setOpenForm(false);
        setIsEdit(false);
        setDetalle(null);
    };

    const columns = [
        {
            header: "Folio",
            render: (row: any) => <span className="font-bold text-slate-900">{row.folio || `#${row.id}`}</span>
        },
        {
            header: "Cliente / Destino",
            render: (row: any) => (
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-700">{row.cliente || 'N/A'}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold">{row.destino || 'Sin destino'}</span>
                </div>
            ),
        },
        {
            header: "Producto",
            render: (row: any) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                    {row.producto || 'Combustible'}
                </span>
            ),
        },
        {
            header: "Cantidad",
            render: (row: any) => (
                <span className="text-sm font-mono font-bold text-slate-600">
                    {row.total_litros?.toLocaleString() || '0'} Lts
                </span>
            ),
        },
        {
            header: "Acciones",
            align: 'right' as const,
            render: (row: any) => (
                <button
                    disabled={loadingDetalle}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shadow-sm disabled:opacity-50"
                    onClick={() => handleEdit(row)}
                >
                    <Eye size={18} className={loadingDetalle ? "animate-pulse" : ""} />
                </button>
            ),
        },
    ];

    useEffect(() => {
        cargarDatos();
    }, [filterDate]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Remisiones" />
            <div className="p-6">
                {!openForm ? (
                    <div className="space-y-6 animate-in fade-in duration-500">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-black tracking-tight text-slate-900">Remisiones</h2>
                                <p className="text-sm text-slate-500 font-medium">Gestión y control de remisiones de autotanques.</p>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="relative flex items-center">
                                    <Calendar className="absolute left-3 text-slate-400" size={18} />
                                    <input
                                        type="date"
                                        value={filterDate}
                                        onChange={(e) => setFilterDate(e.target.value)}
                                        className="pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-sm outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all text-slate-600 font-bold"
                                    />
                                </div>

                                <button
                                    onClick={() => setOpenForm(true)}
                                    className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-700 shadow-lg shadow-indigo-100 active:scale-95"
                                >
                                    <Plus size={18} strokeWidth={3} />
                                    <span>Nueva Remisión</span>
                                </button>
                            </div>
                        </div>

                        <UniversalTable
                            columns={columns}
                            data={data}
                            loading={loading}
                            emptyMessage="No se encontraron remisiones para la fecha seleccionada"
                            loadingMessage="Consultando remisiones..."
                        />
                    </div>
                ) : (
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleBack}
                                className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-3 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm"
                            >
                                <ChevronLeft size={20} strokeWidth={3} />
                            </button>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900">
                                    {isEdit ? 'Detalle de Remisión' : 'Nueva Remisión'}
                                </h2>
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Registro de carga y transporte</p>
                            </div>
                        </div>

                        <div className="mx-auto max-w-5xl">
                            <EoloForm
                                data={detalle}
                                isEdit={isEdit}
                                onSuccess={() => {
                                    handleBack();
                                    cargarDatos();
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
