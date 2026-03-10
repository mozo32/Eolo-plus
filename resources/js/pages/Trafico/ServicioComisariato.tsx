import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import ServicioComisariatoForm from './servicioComisariato/ServicioComisariatoForm';
import { DataTable, Column } from '@/components/DataTable';
import { useState, useEffect } from 'react';
import { fetchServicioComisariato, fetchShowServicioComisariato } from '@/stores/apiServicioComisariato';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Servicio Comisariato' }];

export default function ServicioComisariato() {
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [detalle, setDetalle] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [data, setData] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [isEdit, setIsEdit] = useState(false);

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

    const formatFecha = (fecha: string) => {
        const [y, m, d] = fecha.split("T")[0].split("-");
        return new Date(Number(y), Number(m) - 1, Number(d))
            .toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "long",
                year: "numeric",
            });
    };

    const handleEdit = async (id: number) => {
        try {
            setLoadingDetalle(true);
            const dat = await fetchShowServicioComisariato(id);
            setDetalle(dat);
            setIsEdit(true);
            setShowForm(true);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingDetalle(false);
        }
    };

    const handleBack = () => {
        setShowForm(false);
        setIsEdit(false);
        setDetalle(null);
    };

    const columns: Column<any>[] = [
        { key: "id", header: "ID" },
        {
            key: "fecha_entrega",
            header: "Fecha",
            render: (row) => formatFecha(row.fecha_entrega),
        },
        { key: "catering", header: "Catering" },
        { key: "matricula", header: "Matrícula" },
        { key: "forma_pago", header: "Forma de Pago" },
        {
            key: "acciones",
            header: "Acciones",
            render: (row) => (
                <button className="text-blue-600" onClick={() => handleEdit(row.id)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </button>
            ),
        },
    ];

    useEffect(() => {
        if (!showForm) cargarDatos();
    }, [page, search, showForm]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Servicio Comisariato" />
            <div className="p-4 md:p-6">
                {!showForm ? (
                    <div className="rounded-xl border bg-white p-6 shadow-sm">
                        <div className="mb-6 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Registros de Comisariato</h2>
                                <p className="text-sm text-slate-500">Gestión de servicios y entregas</p>
                            </div>
                            <button
                                onClick={() => { setIsEdit(false); setShowForm(true); }}
                                className="flex items-center gap-2 rounded-lg bg-[#00677F] px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-105"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Nuevo Registro
                            </button>
                        </div>
                        <DataTable
                            data={data}
                            columns={columns}
                            keyField="id"
                            loading={loading}
                            search={search}
                            onSearchChange={(v) => { setPage(1); setSearch(v); }}
                            meta={meta}
                            onPageChange={(p) => setPage(p)}
                        />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <button
                            onClick={handleBack}
                            className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#00677F]"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                            Volver al listado
                        </button>
                        <ServicioComisariatoForm
                            isEdit={isEdit}
                            data={detalle}
                            open={showForm}
                            onSuccess={() => {
                                setShowForm(false);
                                cargarDatos();
                            }}
                        />
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
