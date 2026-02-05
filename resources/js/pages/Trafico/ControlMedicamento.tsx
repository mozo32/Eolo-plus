import { useState, useEffect } from 'react';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

import ControlMedicamentoForm from './controlMedicamento/ControlMedicamentoForm';
import ControlMedicamentoIndex from './controlMedicamento/ControlMedicamentoIndex';
import MedicamentosControl from './controlMedicamento/MedicamentosControl';
import MedicamentosModule from './controlMedicamento/MedicamentosModule';

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

            <MedicamentosModule/>

        </AppLayout>
    );
}
