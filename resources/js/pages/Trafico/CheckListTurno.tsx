import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import CheckListTurnoForm from './checkListTurno/CheckListTurnoForm';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'CheckListTurno',
    },
];

export default function CheckListTurno() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="CheckListTurno" />
            <CheckListTurnoForm />
        </AppLayout>
    );
}
