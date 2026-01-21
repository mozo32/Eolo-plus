import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import EntregaTurnoRForm from './entregaTurnoR/EntregaTurnoRForm';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Entrega Turno',
    },
];

export default function EntregaTurnoR() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Entrega Turno" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <EntregaTurnoRForm />
            </div>
        </AppLayout>
    );
}
