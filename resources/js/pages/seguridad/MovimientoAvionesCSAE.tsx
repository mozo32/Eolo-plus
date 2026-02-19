import { DataTable, Column } from '@/components/DataTable';
import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import MovimientoCSAEForm from './MovimientoAvionesCSAE/MovimientoCSAEForm';
import { useState, useEffect } from 'react';
import { fetchMovimientoCSAE, fetchShowMovimientoCSAE } from '@/stores/apiMovimientoCSAE';
import { Activity, Plane, X } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'MovimientoAvionesCSAE',
    },
];

export default function MovimientoAvionesCSAE() {
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [detalle, setDetalle] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState<any>(null);
    const [data, setData] = useState<any[]>([]);
    const [openForm, setOpenForm] = useState(false);

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
            setLoadingDetalle(true);
            const dat = await fetchShowMovimientoCSAE(id);
            setDetalle(dat)
            setOpenForm(true);
            setIsEdit(true);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingDetalle(false);
        }
    }
    const columns: Column<any>[] = [
        { key: "id", header: "ID" },
        {
            key: "fecha_hora_entrada",
            header: "Fecha Entrada",
            render: (row) => formatFecha(row.fecha_hora_entrada),
        },
        {
            key: "matricula",
            header: "Matricula",
            render: (row) => row.matricula,
        },
        {
            key: "tipo_aeronave",
            header: "Tipo Aeronave",
            render: (row) => row.tipo_aeronave,
        },
        {
            key: "fecha_hora_salida",
            header: "Fecha Salida",
            render: (row) => formatFecha(row.fecha_hora_salida),
        },
        {
            key: "acciones",
            header: "Acciones",
            render: (row) => (
                <button
                    className="text-blue-600 hover:underline"
                    onClick={() => show(row.id)}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="25"
                        height="25"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#007aff"
                        stroke-width="1.75"
                        stroke-linecap="round"
                        stroke-linejoin="round"
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
            <Head title="Movimiento de Aviones CSAE" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-4">
                <div className="relative flex-1 rounded-xl border p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Registros</h2>
                        <button
                            onClick={() => setOpenForm(true)}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        >
                            Nuevo Registro
                        </button>
                    </div>
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
                        emptyMessage="No hay registros de entrega de turno"
                    />
                </div>
            </div>

            {openForm && (
                <div className="fixed inset-0 z-50 flex flex-col bg-slate-50/80 backdrop-blur-2xl dark:bg-slate-950/90 animate-in fade-in duration-300">
                    <header className="flex items-center justify-between px-8 py-4 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black tracking-[0.3em] text-blue-600 dark:text-blue-400 uppercase">
                                    Terminal Operativa
                                </span>
                                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    {isEdit ? 'Actualización de Manifiesto' : 'Nuevo Registro de Movimiento'}
                                    <span className="ml-2 px-2 py-0.5 rounded text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-500">
                                        v2.4
                                    </span>
                                </h2>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="hidden lg:flex flex-col items-end mr-4 border-r border-slate-300 dark:border-slate-700 pr-4">
                                <span className="text-[9px] text-slate-400 uppercase font-medium">Estado del Sistema</span>
                                <span className="text-[10px] text-green-500 font-bold flex items-center gap-1">
                                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-ping" />
                                    Sincronizado
                                </span>
                            </div>

                            <button
                                onClick={() => {
                                    setOpenForm(false);
                                    setIsEdit(false);
                                    setDetalle(null);
                                }}
                                className="group flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-red-600 dark:hover:bg-red-500 dark:hover:text-white transition-all duration-300"
                            >
                                <span className="text-xs font-bold uppercase tracking-wider">Cancelar</span>
                                <X size={18} className="group-hover:rotate-90 transition-transform" />
                            </button>
                        </div>
                    </header>
                    <main className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                        <aside className="lg:w-72 p-8 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 hidden lg:block">
                            <div className="space-y-8">
                                <div>
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 italic">Protocolo</h4>
                                    <ul className="space-y-4">
                                        {['Verificación de Matrícula', 'Estado de Aeronave', 'Firma de Responsable'].map((item, i) => (
                                            <li key={i} className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                                                <div className="h-5 w-5 rounded-full border border-blue-500 flex items-center justify-center text-[10px] font-bold text-blue-500">
                                                    {i + 1}
                                                </div>
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                                    <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed font-medium">
                                        <strong>Nota:</strong> Los datos registrados aquí se sincronizan automáticamente con el servidor central de CSAE.
                                    </p>
                                </div>
                            </div>
                        </aside>
                        <section className="flex-1 overflow-y-auto bg-white/40 dark:bg-transparent backdrop-blur-sm">
                            <div className="max-w-4xl mx-auto p-8 lg:p-16">
                                <div className="mb-12">
                                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">
                                        {isEdit ? 'Modificar Registro' : 'Iniciando Registro'}
                                    </h1>
                                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                                        Complete los campos técnicos requeridos para la operación de aviación.
                                    </p>
                                </div>

                                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none">
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
                            </div>
                        </section>
                    </main>
                </div>
            )}
        </AppLayout>
    );
}
