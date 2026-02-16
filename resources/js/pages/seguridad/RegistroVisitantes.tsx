import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import RegistroVisitantesForm from './RegistroVisitantes/RegistroVisitantesFrom';
import RegistroVisitantesSalida from './RegistroVisitantes/RegistroVisitantesSalida';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'RegistroVisitantes',
    },
];

export default function RegistroVisitantes() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="RegistroVisitantes" />
            <RegistroVisitantesSalida />
        </AppLayout>
    );
}
