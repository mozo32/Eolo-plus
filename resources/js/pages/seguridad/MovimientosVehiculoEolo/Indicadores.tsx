import { Vehiculo } from './types';

interface Props {
    vehiculos: Vehiculo[];
}

export const Indicadores = ({ vehiculos }: Props) => {
    // Solo las unidades que pueden trabajar hoy. Un vehículo desactivado está siempre
    // «En Planta» —no pudo salir—, así que sin este filtro la tarjeta lo contaría como
    // disponible justo encima de la tabla donde sale marcado DESACTIVADO.
    const disponibles = vehiculos.filter(v => v.activo);

    const enPlanta = disponibles.filter(v => v.estado === 'En Planta').length;
    const enRuta = disponibles.filter(v => v.estado === 'En Ruta').length;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500">
                <p className="text-sm text-gray-500 uppercase font-bold">En Planta</p>
                <p className="text-2xl font-semibold text-green-700">{enPlanta}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-orange-500">
                <p className="text-sm text-gray-500 uppercase font-bold">En Ruta</p>
                <p className="text-2xl font-semibold text-orange-700">{enRuta}</p>
            </div>
        </div>
    );
};
