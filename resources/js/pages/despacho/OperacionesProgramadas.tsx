import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import OperacionesProgramadasIndex from './operacionesProgramadas/OperacionesProgramadasIndex';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Operaciones Programadas' }];

export default function OperacionesProgramadas() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Operaciones Programadas" />
            <OperacionesProgramadasIndex />
        </AppLayout>
    );
}
