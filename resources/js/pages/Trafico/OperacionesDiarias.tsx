
import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import OperacionesDiariasForm from './operacionesDiarias/OperacionesDiariasForm';
import OperacionesDiariasIndex from './operacionesDiarias/OperacionesDiariasIndex';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'OperacionesDiarias',
    },
];

export default function OperacionesDiarias() {
    const [openForm, setOpenForm] = useState(false);
    const [isEdit, setIsEdit] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="OperacionesDiarias" />

            {/* BOTÓN NUEVA OPERACIÓN */}
            <div className="mb-4 flex items-center justify-end">
                <button
                    onClick={() => {
                        setOpenForm(true);
                        setIsEdit(false);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#00677F] px-5 py-2.5 text-sm font-bold text-white shadow hover:bg-[#00586D] transition"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                    </svg>
                    Nueva operación
                </button>
            </div>

            <OperacionesDiariasIndex refreshKey={refreshKey} />
            {openForm && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
                    onClick={() => {
                        setOpenForm(false);
                        setIsEdit(false);
                        // setDetalle(null);
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
                    >
                        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className={`flex h-10 w-10 items-center justify-center rounded-full
                                                ${isEdit
                                            ? 'bg-orange-100 text-orange-600'
                                            : 'bg-[#00677F]/10 text-[#00677F]'}
                                                `}
                                >
                                    {isEdit ? (
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-5 w-5"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M12 20h9" />
                                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                                        </svg>
                                    ) : (
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-5 w-5"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        >
                                            <path d="M12 5v14" />
                                            <path d="M5 12h14" />
                                        </svg>
                                    )}
                                </div>

                                <div>
                                    <h3 className="text-lg font-extrabold text-slate-800 dark:text-white">
                                        {isEdit
                                            ? 'Actualizar Servicio de Comisariato'
                                            : 'Nuevo Servicio de Comisariato'}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Área Operativa
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    setOpenForm(false);
                                    setIsEdit(false);
                                    // setDetalle(null);
                                }}
                                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30"
                                aria-label="Cerrar"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-5 w-5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M18 6L6 18" />
                                    <path d="M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6">
                            <OperacionesDiariasForm
                                onSuccess={() => {
                                    setOpenForm(false);
                                    setRefreshKey((prev) => prev + 1);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
