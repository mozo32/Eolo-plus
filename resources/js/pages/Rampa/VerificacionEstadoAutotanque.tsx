import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { CheckEstadoAutotanque } from './VerificacionEstadoAutotanque/CheckEstadoAutotanque';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'VerificacionEstadoAutotanque',
    },
];

export default function VerificacionEstadoAutotanque() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="VerificacionEstadoAutotanque" />
            <CheckEstadoAutotanque />
        </AppLayout>
    );
}
