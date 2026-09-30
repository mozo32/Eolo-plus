import { apiProveedores } from '@/stores/apiFacturacionCatalogos';
import { type BreadcrumbItem } from '@/types';
import PantallaCatalogo from './components/PantallaCatalogo';
import type { TextosCatalogo } from './components/useCatalogo';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Proveedores' }];

const textos: TextosCatalogo = {
    baja: 'Ya no se podrá elegir en registros nuevos; lo registrado hasta hoy no cambia. Podrás reactivarlo desde el filtro "De baja".',
    reactivar: 'Volverá a poder elegirse en registros nuevos.',
};

/** Proveedores de los servicios de tercero: solo el nombre (hasta 120 caracteres). */
export default function Proveedores() {
    return (
        <PantallaCatalogo
            titulo="Proveedores"
            descripcion="Quién presta los servicios de tercero"
            breadcrumbs={breadcrumbs}
            textoAlta="NUEVO PROVEEDOR"
            tituloAlta="Nuevo proveedor"
            tituloEdicion="Editar proveedor"
            campos={[]}
            api={apiProveedores}
            nombreMax={120}
            textos={textos}
        />
    );
}
