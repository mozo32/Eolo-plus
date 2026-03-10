import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import CheckListEquipoForm from './checkListEquipo/CheckListEquipoForm';
import { DataTable, Column } from '@/components/DataTable';
import { useState, useEffect } from 'react';
import { fetchCheckListEquipo, fetchCheckUser } from '@/stores/apiCheckListEquipoSeguridad';
import { ChevronLeft, Plus } from "lucide-react";

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'CheckList Equipo',
    },
];

export default function CheckListEquipo() {
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [data, setData] = useState<any[]>([]);
    const [openForm, setOpenForm] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [detalle, setDetalle] = useState<any>(null);

    const formatFecha = (fecha: string) => {
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
            const res = await fetchCheckListEquipo({
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
            setLoadingDetalle(true);
            const dat = await fetchCheckUser(id);
            setDetalle(dat);
            setIsEdit(true);
            setOpenForm(true);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingDetalle(false);
        }
    };

    const handleBack = () => {
        setOpenForm(false);
        setIsEdit(false);
        setDetalle(null);
    };

    const columns: Column<any>[] = [
        { key: "id", header: "ID" },
        {
            key: "created_at",
            header: "Fecha",
            render: (row) => formatFecha(row.created_at),
        },
        {
            key: "nombre",
            header: "Nombre",
            render: (row) => row.nombre,
        },
        {
            key: "acciones",
            header: "Acciones",
            render: (row) => (
                <button
                    className="p-1 hover:bg-blue-50 rounded-full transition-colors"
                    onClick={() => show(row.user_id)}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#007aff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
                        <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
                        <path d="M16 5l3 3" />
                    </svg>
                </button>
            ),
        },
    ];

    useEffect(() => {
        cargarDatos();
    }, [page, search]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="CheckList Equipo" />
            <div className="p-6">
                {!openForm ? (
                    /* VISTA DE TABLA */
                    <div className="space-y-4 animate-in fade-in duration-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight text-slate-800">Registros de Seguridad</h2>
                                <p className="text-sm text-slate-500">Administra y consulta las revisiones mensuales de EPP.</p>
                            </div>
                            <button
                                onClick={() => setOpenForm(true)}
                                className="flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-blue-600 shadow-lg shadow-blue-100"
                            >
                                <Plus size={18} />
                                Nuevo Registro
                            </button>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <DataTable
                                data={data}
                                columns={columns}
                                keyField="id"
                                loading={loading}
                                search={search}
                                onSearchChange={(value) => {
                                    setPage(1);
                                    setSearch(value);
                                }}
                                meta={meta}
                                onPageChange={(p) => setPage(p)}
                                emptyMessage="No hay registros de equipo de seguridad"
                            />
                        </div>
                    </div>
                ) : (
                    /* VISTA DE FORMULARIO (Sin Modal) */
                    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleBack}
                                className="flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">
                                    {isEdit ? 'Editar Auditoría' : 'Nuevo Registro de Equipo'}
                                </h2>
                                <p className="text-xs font-medium uppercase tracking-widest text-slate-400">Volver al listado principal</p>
                            </div>
                        </div>

                        <div className="mx-auto max-w-5xl">
                            <CheckListEquipoForm
                                isEdit={isEdit}
                                data={detalle?.data}
                                open={openForm}
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
