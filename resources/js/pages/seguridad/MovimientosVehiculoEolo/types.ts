export type EstadoVehiculo = 'En Planta' | 'En Ruta';

export interface Vehiculo {
    id: string;
    nombre: string;
    estado: EstadoVehiculo;
    ultimaActividad: string;
}
