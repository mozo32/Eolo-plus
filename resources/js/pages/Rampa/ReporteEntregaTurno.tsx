import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import EntregarTurnoAutotanque from './Autotanque/EntregarTurnoAutotanque';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'ReporteEntregaTurno',
    },
];

export default function ReporteEntregaTurno() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="ReporteEntregaTurno" />
            <EntregarTurnoAutotanque />
        </AppLayout>
    );
}
