import { useState, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

import ControlMedicamentoForm from './controlMedicamento/ControlMedicamentoForm';
import ControlMedicamentoIndex from './controlMedicamento/ControlMedicamentoIndex';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Control Medicamento',
    },
];

export default function ControlMedicamento() {
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [controlData, setControlData] = useState<any>(null);
    const abrirModal = async () => {
        const res = await fetch('/api/ControlMedicamento/current');
        const data = await res.json();


        if (data && data.id) {
            setEditing(true);
            setControlData(data);
        } else {
            setEditing(false);
            setControlData(null);
        }

        setOpen(true);
    };
    useEffect(() => {
        document.body.style.overflow = open ? 'hidden' : 'auto';
    }, [open]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="ControlMedicamento" />

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-extrabold text-[#00677F]">
                    Control de Medicamentos
                </h1>

                <button
                    onClick={abrirModal}
                    className="bg-[#00677F] text-white font-bold px-5 py-2 rounded-xl
                               hover:bg-[#005466] transition"
                >
                    + Nuevo control
                </button>
            </div>

            {/* LISTADO */}
            <ControlMedicamentoIndex refreshKey={refreshKey} />

            {/* MODAL */}
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">

                    <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl
                        max-h-[90vh] flex flex-col relative">

                        {/* HEADER (FIJO) */}
                        <div className="flex justify-between items-center p-6 border-b shrink-0">
                            <h2 className="text-xl font-extrabold text-[#00677F]">
                                {editing ? 'Editar Control de Medicamento' : 'Nuevo Control de Medicamento'}
                            </h2>

                            <button
                                onClick={() => setOpen(false)}
                                className="text-2xl font-bold text-slate-400 hover:text-red-500"
                            >
                                ×
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <ControlMedicamentoForm
                                initialData={controlData}
                                isEdit={editing}
                                onClose={() => setOpen(false)}
                                onSaved={() => {
                                    setOpen(false);
                                    setRefreshKey(prev => prev + 1);
                                }}
                            />
                        </div>

                    </div>
                </div>
            )}
        </AppLayout>
    );
}
