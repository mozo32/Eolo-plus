
import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import OperacionesDiariasForm from './operacionesDiarias/OperacionesDiariasForm';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'OperacionesDiarias',
    },
];

export default function OperacionesDiarias() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="OperacionesDiarias" />
            <OperacionesDiariasForm />
        </AppLayout>
    );
}
