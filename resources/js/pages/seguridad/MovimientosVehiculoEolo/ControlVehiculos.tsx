import React, { useState, useEffect } from 'react';
import { Plus, FileSpreadsheet } from 'lucide-react';
import { usePage } from '@inertiajs/react';
import { Vehiculo } from './types';
import { Indicadores } from './Indicadores';
import { TablaVehiculos } from './TablaVehiculos';
import { ModalMovimiento } from './ModalMovimiento';
import { ModalNuevoVehiculo } from './ModalNuevoVehiculo';
import { ExcelVehiculosModal } from './ExcelVehiculosModal';
import { apiVehiculoEolo } from '@/stores/apiVehiculoEolo';

/**
 * Roles que pueden dar de baja o de alta un vehículo. La misma lista que
 * guarda el servidor en VehiculoEoloController::ROLES_PARA_CAMBIAR_ACTIVO:
 * aquí solo decide si se dibuja el botón, el permiso de verdad está allá.
 */
const ROLES_PARA_DESACTIVAR = ['fbo', 'admin2', 'admin'];

const ControlVehiculos = () => {
    const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isNuevoModalOpen, setIsNuevoModalOpen] = useState(false);
    const [selectedVehiculo, setSelectedVehiculo] = useState<Vehiculo | null>(null);
    const [tipoAccion, setTipoAccion] = useState<'Salida' | 'Entrada'>('Salida');
    const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
    const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
    const { auth } = usePage<{ auth: { user: { roles?: { slug: string }[] } } }>().props;
    // La lista ENTERA, no roles[0]: con dos roles, el permitido podría no ser el primero.
    const puedeDesactivar = (auth.user.roles ?? []).some(rol => ROLES_PARA_DESACTIVAR.includes(rol.slug));

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

    const handleCambiarActivo = async (vehiculo: Vehiculo) => {
        const desactivando = vehiculo.activo;
        const pregunta = desactivando
            ? `¿Desactivar ${vehiculo.nombre} (${vehiculo.id})? Dejará de poder registrar entradas y salidas; su bitácora se seguirá consultando.`
            : `¿Reactivar ${vehiculo.nombre} (${vehiculo.id})?`;

        if (!window.confirm(pregunta)) {
            return;
        }

        try {
            await apiVehiculoEolo.cambiarActivo(vehiculo.id, !vehiculo.activo);
            await fetchVehiculos();
        } catch (error: any) {
            alert('Error: ' + (error.message || 'No se pudo cambiar el estado del vehículo'));
        }
    };

    const alternarSeleccion = (id: string) => {
        setSeleccionados(previos => {
            const siguiente = new Set(previos);

            if (siguiente.has(id)) {
                siguiente.delete(id);
            } else {
                siguiente.add(id);
            }

            return siguiente;
        });
    };

    const alternarTodos = () => {
        setSeleccionados(previos =>
            previos.size === vehiculos.length ? new Set() : new Set(vehiculos.map(v => v.id)),
        );
    };

    const vehiculosSeleccionados = vehiculos.filter(v => seleccionados.has(v.id));

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
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsExcelModalOpen(true)}
                            disabled={seleccionados.size === 0}
                            title={
                                seleccionados.size === 0
                                    ? 'Marca al menos un vehículo para exportar'
                                    : `Exportar ${seleccionados.size} vehículo(s)`
                            }
                            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-100"
                        >
                            <FileSpreadsheet size={18} />
                            Excel
                        </button>
                        <button
                            onClick={() => setIsNuevoModalOpen(true)}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                        >
                            <Plus size={18} />
                            Nuevo Vehículo
                        </button>
                    </div>
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
                            puedeDesactivar={puedeDesactivar}
                            onCambiarActivo={handleCambiarActivo}
                            seleccionados={seleccionados}
                            onAlternarSeleccion={alternarSeleccion}
                            onAlternarTodos={alternarTodos}
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

            {isExcelModalOpen && (
                <ExcelVehiculosModal
                    isOpen
                    vehiculosSeleccionados={vehiculosSeleccionados}
                    onClose={() => setIsExcelModalOpen(false)}
                />
            )}
        </div>
    );
};

export default ControlVehiculos;
