import { Vehiculo } from './types';
import { FilaVehiculo } from './FilaVehiculo';

interface Props {
    vehiculos: Vehiculo[];
    onAccion: (vehiculo: Vehiculo, tipo: 'Salida' | 'Entrada') => void;
}

export const TablaVehiculos = ({ vehiculos, onAccion }: Props) => {
    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
            <table className="w-full text-left">
                <thead className="bg-gray-100 border-b">
                    <tr>
                        <th className="p-4 text-sm font-semibold text-gray-600">Vehículo</th>
                        <th className="p-4 text-sm font-semibold text-gray-600">Estado</th>
                        <th className="p-4 text-sm font-semibold text-gray-600">Último Movimiento</th>
                        <th className="p-4 text-sm font-semibold text-gray-600 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {vehiculos.map(v => (
                        <FilaVehiculo
                            key={v.id}
                            vehiculo={v}
                            onAccion={onAccion}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
};
