import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import ServicioComisariatoForm from './servicioComisariato/ServicioComisariatoForm';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'ServicioComisariato',
    },
];

export default function ServicioComisariato() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="ServicioComisariato" />
            <ServicioComisariatoForm />
        </AppLayout>
    );
}
