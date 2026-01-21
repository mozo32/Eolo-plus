import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Asistencia Personal',
    },
];

export default function AsistenciaPersonal() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Asistencia Personal" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                    <h1> hola asistencia</h1>
                </div>
            </div>
        </AppLayout>
    );
}
