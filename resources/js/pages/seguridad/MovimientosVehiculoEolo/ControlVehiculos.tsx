import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Vehiculo } from './types';
import { Indicadores } from './Indicadores';
import { TablaVehiculos } from './TablaVehiculos';
import { ModalMovimiento } from './ModalMovimiento';
import { ModalNuevoVehiculo } from './ModalNuevoVehiculo';
import { apiVehiculoEolo } from '@/stores/apiVehiculoEolo';

const ControlVehiculos = () => {
    const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isNuevoModalOpen, setIsNuevoModalOpen] = useState(false);
    const [selectedVehiculo, setSelectedVehiculo] = useState<Vehiculo | null>(null);
    const [tipoAccion, setTipoAccion] = useState<'Salida' | 'Entrada'>('Salida');

    const fetchVehiculos = async () => {
        try {
            setLoading(true);
            const data = await apiVehiculoEolo.getVehiculos();
            setVehiculos(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVehiculos();
    }, []);

    const handleNuevoVehiculo = async (data: any) => {
        try {
            await apiVehiculoEolo.crearVehiculo(data);
            await fetchVehiculos();
            setIsNuevoModalOpen(false);
            alert("Vehículo agregado exitosamente");
        } catch (error: any) {
            alert("Error al crear: " + (error.message || "Error desconocido"));
        }
    };

    const abrirModal = (vehiculo: Vehiculo, tipo: 'Salida' | 'Entrada') => {
        setSelectedVehiculo(vehiculo);
        setTipoAccion(tipo);
        setIsModalOpen(true);
    };

    const cerrarModal = () => {
        setIsModalOpen(false);
        setSelectedVehiculo(null);
    };

    const handleFormSubmit = async (formData: FormData) => {
        if (!selectedVehiculo) {
            alert('No se seleccionó ningún vehículo');
            return;
        }

        formData.set('vehiculo_id', String(selectedVehiculo.id));
        formData.set('movimiento', tipoAccion);



        try {
            await apiVehiculoEolo.registrarMovimiento(formData);

            await fetchVehiculos();

            window.dispatchEvent(
                new CustomEvent('movimiento-registrado')
            );

            cerrarModal();
            alert('Registro guardado correctamente');
        } catch (error: any) {
            const errorMessages = Object.values(error.errors || {})
                .flat()
                .join('\n');

            alert('Error:\n' + (errorMessages || error.message));
        }
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen font-sans relative">
            <div className="max-w-6xl mx-auto">
                <header className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            Control de Bitácora: Entradas y Salidas
                        </h1>
                        <p className="text-gray-500">Gestión de flota vehicular</p>
                    </div>
                    <button
                        onClick={() => setIsNuevoModalOpen(true)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                        <Plus size={18} />
                        Nuevo Vehículo
                    </button>
                </header>

                {loading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-4"></div>
                        <p className="text-gray-500 font-medium">Sincronizando con servidor...</p>
                    </div>
                ) : (
                    <>
                        <Indicadores vehiculos={vehiculos} />
                        <TablaVehiculos
                            vehiculos={vehiculos}
                            onAccion={abrirModal}
                        />
                    </>
                )}
            </div>

            <ModalMovimiento
                isOpen={isModalOpen}
                vehiculo={selectedVehiculo}
                tipoAccion={tipoAccion}
                onClose={cerrarModal}
                onSubmit={handleFormSubmit}
            />

            <ModalNuevoVehiculo
                isOpen={isNuevoModalOpen}
                onClose={() => setIsNuevoModalOpen(false)}
                onSubmit={handleNuevoVehiculo}
            />
        </div>
    );
};

export default ControlVehiculos;
