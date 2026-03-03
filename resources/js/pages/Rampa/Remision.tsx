import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import EoloForm from './Autotanque/EoloForm';
import IndexRemisiones from './Autotanque/IndexRemisiones';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Remision',
    },
];

export default function Remision() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Remision" />
            <EoloForm />
        </AppLayout>
    );
}
