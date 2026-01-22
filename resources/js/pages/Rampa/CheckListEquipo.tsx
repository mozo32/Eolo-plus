import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import CheckListEquipoForm from './checkListEquipo/CheckListEquipoForm';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'CheckList Equipo',
    },
];

export default function CheckListEquipo() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="CheckList Equipo" />
            <CheckListEquipoForm />
        </AppLayout>
    );
}
