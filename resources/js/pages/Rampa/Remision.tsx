import PdfExporterRemision from './Autotanque/PdfExporterRemision';
import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import EoloForm from './Autotanque/EoloForm';
import UniversalTable from '../UniversalTable';
import { useState, useEffect, useCallback } from 'react';
import { fetchRemisionesDelDia, fetchRemisionById } from '@/stores/apiAutoTanque';
import { ChevronLeft, Plus, Mail, Calendar, X, Edit2 } from "lucide-react";
import ModalEnviarCorreo from './Autotanque/ModalEnviarCorreo';
import Swal from 'sweetalert2';
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
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [selectedRow, setSelectedRow] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [filterType, setFilterType] = useState<'day' | 'range' | 'month' | 'year'>('day');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const getXsrfToken = () => {
        return decodeURIComponent(
            document.cookie
                .split('; ')
                .find(row => row.startsWith('XSRF-TOKEN='))
                ?.split('=')[1] || ''
        );
    };
    const handleSendEmail = async (email: string) => {
        const xsrf = getXsrfToken();
        Swal.fire({
            title: 'Enviando correo',
            text: 'Por favor, espere un momento...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading(); // Esto activa el spinner de carga
            }
        });
        try {
            const response = await fetch('api/Remision/enviar-correo', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': xsrf,
                },
                body: JSON.stringify({
                    id: selectedRow?.id,
                    email: email
                })
            });

            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }

            Swal.fire({
                icon: 'success',
                title: '¡Enviado!',
                text: 'La remisión ha sido enviada correctamente.',
                confirmButtonColor: '#4f46e5',
            });
        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Hubo un problema al conectar con el servidor.',
                confirmButtonColor: '#ef4444',
            });
        }
    };
    const handlePdfDone = useCallback(() => setPdfId(null), []);
    const cargarDatos = async () => {
        try {
            setLoading(true);
            let params: any = { type: filterType };

            if (filterType === 'day') params.date = filterDate;
            if (filterType === 'range') { params.start = startDate; params.end = endDate; }
            if (filterType === 'month') { params.month = selectedMonth; params.year = selectedYear; }
            if (filterType === 'year') params.year = selectedYear;

            const res = await fetchRemisionesDelDia({
                params,
                page,
                per_page: 20,
            });

            setData(res.data || []);
            setMeta(res);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, [page,filterDate, startDate, endDate, selectedMonth, selectedYear, filterType]);

    const handleEdit = async (row: any) => {
        try {
            setLoadingDetalle(true);
            const datosCompletos = await fetchRemisionById(row.id);

            setDetalle(datosCompletos);
            setIsEdit(true);
            setOpenForm(true);
        } catch (error) {
            console.error("Error al obtener detalle:", error);
            Swal.fire({
                icon: 'warning',
                title: 'No se pudo cargar',
                text: 'No logramos obtener la información detallada de la remisión.',
                confirmButtonColor: '#4f46e5',
            });
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
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => handleEdit(row)}
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-[#00677F] rounded-xl transition-all shadow-sm"
                    >
                        <Edit2 size={18} />
                    </button>
                    <button onClick={() => setPdfId(row.id)} className="p-2.5 text-slate-400 hover:text-white hover:bg-amber-600 rounded-xl transition-all shadow-sm" >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
                    </button>
                    <button
                        onClick={() => {
                            setSelectedRow(row);
                            setEmailModalOpen(true);
                        }}
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-[#00677F] rounded-xl transition-all shadow-sm"
                    >
                        <Mail size={18} />
                    </button>
                    <button className="p-2.5 text-slate-400 hover:text-white hover:bg-red-600 rounded-xl transition-all shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18" /><path d="M4 7h3m4 0h9" /><path d="M10 11l0 6" /><path d="M14 14l0 3" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l.077 -.923" /><path d="M18.384 14.373l.616 -7.373" /><path d="M9 5v-1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>
                    </button>
                </div>
            ),
        },
    ];

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
                                <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-3xl border border-slate-100">
                                    {/* Selector de Tipo de Filtro */}
                                    <select
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value as any)}
                                        className="pl-4 pr-8 py-2.5 rounded-2xl border-none bg-white text-xs font-black uppercase tracking-wider shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    >
                                        <option value="day">Día</option>
                                        <option value="range">Rango</option>
                                        <option value="month">Mes</option>
                                        <option value="year">Año</option>
                                    </select>

                                    <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>

                                    <div className="flex items-center gap-2">
                                        {filterType === 'day' && (
                                            <div className="relative flex items-center">
                                                <Calendar className="absolute left-3 text-indigo-500" size={16} />
                                                <input
                                                    type="date"
                                                    value={filterDate}
                                                    onChange={(e) => {setPage(1);setFilterDate(e.target.value)}}
                                                    className="pl-10 pr-4 py-2 text-sm rounded-xl border-none bg-white shadow-sm font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        )}

                                        {filterType === 'range' && (
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => {setPage(1);setStartDate(e.target.value)}}
                                                    className="pl-4 pr-4 py-2 text-sm rounded-xl border-none bg-white shadow-sm font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500"
                                                />
                                                <span className="text-slate-400 font-bold">al</span>
                                                <input
                                                    type="date"
                                                    value={endDate}
                                                    onChange={(e) => {setPage(1);setEndDate(e.target.value)}}
                                                    className="pl-4 pr-4 py-2 text-sm rounded-xl border-none bg-white shadow-sm font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        )}

                                        {filterType === 'month' && (
                                            <div className="flex gap-2">
                                                <select
                                                    value={selectedMonth}
                                                    onChange={(e) => {setPage(1);setSelectedMonth(parseInt(e.target.value))}}
                                                    className="pl-4 pr-8 py-2 text-sm rounded-xl border-none bg-white shadow-sm font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500"
                                                >
                                                    {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((m, i) => (
                                                        <option key={m} value={i + 1}>{m}</option>
                                                    ))}
                                                </select>
                                                <input
                                                    type="number"
                                                    value={selectedYear}
                                                    onChange={(e) => {setPage(1);setSelectedYear(parseInt(e.target.value))}}
                                                    className="w-24 pl-4 py-2 text-sm rounded-xl border-none bg-white shadow-sm font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        )}

                                        {filterType === 'year' && (
                                            <input
                                                type="number"
                                                value={selectedYear}
                                                onChange={(e) => {setPage(1);setSelectedYear(parseInt(e.target.value))}}
                                                className="w-32 pl-4 py-2 text-sm rounded-xl border-none bg-white shadow-sm font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500"
                                                placeholder="Año"
                                            />
                                        )}
                                    </div>
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
                            pagination={{
                                current_page: meta?.current_page || 1,
                                last_page: meta?.last_page || 1,
                                total: meta?.total || 0
                            }}
                            onPageChange={(p) => setPage(p)}
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
            <ModalEnviarCorreo
                isOpen={emailModalOpen}
                onClose={() => setEmailModalOpen(false)}
                onSend={handleSendEmail}
                row={selectedRow}
            />
            <PdfExporterRemision id={pdfId} onDone={handlePdfDone} />
        </AppLayout>
    );
}
