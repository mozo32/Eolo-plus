export type EstadoVehiculo = 'En Planta' | 'En Ruta';

export interface Vehiculo {
    id: string;
    nombre: string;
    estado: EstadoVehiculo;
    ultimaActividad: string;
    /** De alta en la flota. Distinto de `estado`, que es dónde está el vehículo. */
    activo: boolean;
    /** Cuántos movimientos tiene. El servidor ordena la tabla con esto. */
    movimientos: number;
}
