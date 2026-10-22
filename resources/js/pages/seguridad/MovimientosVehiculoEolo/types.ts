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

/** Una fila del reporte, tal y como la sirve GET /api/VehiculoEolo/Excel/. */
export interface FilaExcelVehiculo {
    vehiculo: string;
    numeroEconomico: string;
    fechaHora: string;
    tipo: 'Entrada' | 'Salida';
    chofer: string;
    kilometraje: number;
    gasolina: string;
    destino: string | null;
    autoriza: string | null;
    matricula: string | null;
    motivo: string | null;
    observaciones: string | null;
}

export interface FiltrosExcelVehiculos {
    chofer?: string;
    tipo?: 'Entrada' | 'Salida' | 'Todos';
    fechaInicio?: string;
    fechaFin?: string;
}
