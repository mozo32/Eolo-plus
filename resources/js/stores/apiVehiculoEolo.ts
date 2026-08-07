//apiVehiculoEolo.ts
import { Vehiculo } from "@/pages/seguridad/MovimientosVehiculoEolo/types";

function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-XSRF-TOKEN': getXsrfToken()
};

export const apiVehiculoEolo = {
    getVehiculos: async (): Promise<Vehiculo[]> => {
        const response = await fetch('/api/VehiculoEolo');
        if (!response.ok) throw new Error('Error al cargar vehículos');
        return await response.json();
    },
    registrarMovimiento: async (formData: FormData) => {
        const response = await fetch('/api/VehiculoEolo/movimientos', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'X-XSRF-TOKEN': getXsrfToken(),
            },
            body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
            throw result;
        }

        return result;
    },
    getHistorial: async (vehiculoId: string, filtros?: any) => {
        const params = new URLSearchParams();
        if (filtros) {
            if (filtros.busqueda) params.append('chofer', filtros.busqueda);
            if (filtros.tipo && filtros.tipo !== 'Todos') params.append('tipo', filtros.tipo);
            if (filtros.fechaInicio) params.append('fecha_inicio', filtros.fechaInicio);
            if (filtros.fechaFin) params.append('fecha_fin', filtros.fechaFin);
        }

        const response = await fetch(`/api/VehiculoEolo/vehiculos/${vehiculoId}/movimientos?${params.toString()}`, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) throw new Error('Error al obtener historial');
        return await response.json();
    },
    crearVehiculo: async (vehiculo: any) => {
        const response = await fetch('/api/VehiculoEolo', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(vehiculo)
        });
        const result = await response.json();
        if (!response.ok) throw result;
        return result;
    },
};
