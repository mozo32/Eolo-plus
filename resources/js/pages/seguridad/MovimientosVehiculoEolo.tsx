import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import ControlVehiculos from './MovimientosVehiculoEolo/ControlVehiculos';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'MovimientosVehiculoEolo',
    },
];

export default function MovimientosVehiculoEolo() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="MovimientosVehiculoEolo" />
            <ControlVehiculos />
        </AppLayout>
    );
}
