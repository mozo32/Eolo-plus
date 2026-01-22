import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import ControlMedicamentoForm from './controlMedicamento/ControlMedicamentoForm';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'ControlMedicamento',
    },
];

export default function ControlMedicamento() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="ControlMedicamento" />
            <ControlMedicamentoForm />
        </AppLayout>
    );
}
