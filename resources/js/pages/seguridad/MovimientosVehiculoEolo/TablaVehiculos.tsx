import { useEffect, useRef } from 'react';
import { Vehiculo } from './types';
import { FilaVehiculo } from './FilaVehiculo';

interface Props {
    vehiculos: Vehiculo[];
    onAccion: (vehiculo: Vehiculo, tipo: 'Salida' | 'Entrada') => void;
    puedeDesactivar: boolean;
    onCambiarActivo: (vehiculo: Vehiculo) => void;
    seleccionados: Set<string>;
    onAlternarSeleccion: (id: string) => void;
    onAlternarTodos: () => void;
}

export const TablaVehiculos = ({
    vehiculos,
    onAccion,
    puedeDesactivar,
    onCambiarActivo,
    seleccionados,
    onAlternarSeleccion,
    onAlternarTodos,
}: Props) => {
    const casillaTodos = useRef<HTMLInputElement>(null);
    const todosMarcados = vehiculos.length > 0 && seleccionados.size === vehiculos.length;
    const algunosMarcados = seleccionados.size > 0 && !todosMarcados;

    // El estado indeterminado no existe como atributo en React: solo se puede poner
    // sobre el nodo, de ahí la ref.
    useEffect(() => {
        if (casillaTodos.current) {
            casillaTodos.current.indeterminate = algunosMarcados;
        }
    }, [algunosMarcados]);

    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
            <table className="w-full text-left">
                <thead className="bg-gray-100 border-b">
                    <tr>
                        <th className="p-4 w-12">
                            <input
                                ref={casillaTodos}
                                type="checkbox"
                                checked={todosMarcados}
                                onChange={onAlternarTodos}
                                title="Seleccionar todos"
                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                        </th>
                        <th className="p-4 text-sm font-semibold text-gray-600">Vehículo / N. económico</th>
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
                            puedeDesactivar={puedeDesactivar}
                            onCambiarActivo={onCambiarActivo}
                            seleccionado={seleccionados.has(v.id)}
                            onAlternarSeleccion={() => onAlternarSeleccion(v.id)}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
};
