import { apiFormasPago } from '@/stores/apiFacturacionCatalogos';
import { type BreadcrumbItem } from '@/types';
import PantallaCatalogo from './components/PantallaCatalogo';
import type { TextosCatalogo } from './components/useCatalogo';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Formas de pago' }];

const textos: TextosCatalogo = {
    baja: 'Ya no se podrá elegir al registrar un pago nuevo; lo registrado hasta hoy no cambia. Podrás reactivarla desde el filtro "De baja".',
    reactivar: 'Volverá a poder elegirse al registrar un pago.',
};

/** Formas de pago (efectivo, transferencia…): solo el nombre. */
export default function FormasPago() {
    return (
        <PantallaCatalogo
            titulo="Formas de pago"
            descripcion="Cómo pagan los clientes"
            breadcrumbs={breadcrumbs}
            textoAlta="NUEVA FORMA DE PAGO"
            tituloAlta="Nueva forma de pago"
            tituloEdicion="Editar forma de pago"
            campos={[]}
            api={apiFormasPago}
            textos={textos}
        />
    );
}
