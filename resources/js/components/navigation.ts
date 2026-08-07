import {
    dashboard,
    walkAround,
    entregaTurno,
    gestionarAeronaves,
    gestionUsuarios,
    pernoctadia,
    pernoctames,
    estacionamiento,
    entregaTurnoR,
    asistenciaPersonal,
    checkListEquipo,
    checkListTurno,
    controlMedicamento,
    operacionesDiarias,
    servicioComisariato,
    movimientoAvionesCSAE,
    movimientosVehiculoEolo,
    reporteEntregaTurno,
    verificacionEstadoAutotanque,
    remision,
    inspeccionCombustible,
    registroVisitantes
} from '@/routes'
import { LayoutGrid } from 'lucide-react'

export type Href = string | { url: string }

export type Role = {
    slug: string
    nombre: string
}

export type AuthUser = {
    id: number
    name: string
    email: string
    isAdmin: boolean
    roles: Role[]
    departamentos: {
        id: number
        nombre: string
        subdepartamentos: {
            id: number
            nombre: string
            route?: string
        }[]
    }[]
}
export type NavItem = {
    id: string
    title: string
    href?: Href
    moduleKey?: number
    icon?: any
    children?: NavItem[]
}

export type NavModule = {
    module: string
    key: number
    items: NavItem[]
}


const ROUTE_CONFIG: Record<
    string,
    { href: () => Href; title: string }
> = {
    entregaturno: {
        href: entregaTurno,
        title: 'Entrega de Turno',
    },
    walkaround: {
        href: walkAround,
        title: 'Walk Around',
    },
    usuarios: {
        href: gestionUsuarios,
        title: 'Usuarios',
    },
    pernoctadia: {
        href: pernoctadia,
        title: 'Pernocta del día',
    },
    pernoctames: {
        href: pernoctames,
        title: 'Pernocta por mes',
    },
    estacionamiento: {
        href: estacionamiento,
        title: 'Estacionamiento Subterráneo',
    },
    registrovisitantes: {
        href: registroVisitantes,
        title: 'Registro de Visitantes',
    },
    entregaturnor: {
        href: entregaTurnoR,
        title: 'Entrega de Turno',
    },
    checklistequipo: {
        href: checkListEquipo,
        title: 'Checklist de Equipo de Seguridad',
    },
    movimientoavionescsae: {
        href: movimientoAvionesCSAE,
        title: 'Movimiento de Aviones CSAE',
    },
    movimientosvehiculoeolo: {
        href: movimientosVehiculoEolo,
        title: 'Movimientos de Vehiculos EOLO',
    },
    operacionesdiarias: {
        href: operacionesDiarias,
        title: 'Operaciones Diarias',
    },
    controlmedicamento: {
        href: controlMedicamento,
        title: 'Control de Medicamento',
    },
    serviciocomisariato: {
        href: servicioComisariato,
        title: 'Servicio de Comisariato',
    },
    checklistturno: {
        href: checkListTurno,
        title: 'Entrega de Turno',
    },
    reporteentregaturno: {
        href: reporteEntregaTurno,
        title: 'Entrega de Turno',
    },
    remision: {
        href: remision,
        title: 'Remisión',
    },
    verificacionestadoautotanque: {
        href: verificacionEstadoAutotanque,
        title: 'Verificacion Estado Autotanque',
    },
    inspeccioncombustible: {
        href: inspeccionCombustible,
        title: 'Inspección Combustible',
    },
}


export function getNavModules(user: AuthUser | null): NavModule[] {
    if (!user) return []

    if (user.isAdmin) {
        return [
            {
                module: 'Despacho',
                key: 1,
                items: [
                    { id: 'despacho-around', title: 'Walk Around', href: walkAround(), icon: LayoutGrid },
                    { id: 'despacho-turno', title: 'Entrega de Turno', href: entregaTurno(), icon: LayoutGrid },
                    { id: 'despacho-operaciones', title: 'Operaciones Diarias', href: operacionesDiarias(), icon: LayoutGrid },
                    { id: 'despacho-aeronaves', title: 'Gestionar Aeronaves', href: gestionarAeronaves(), icon: LayoutGrid },
                ],
            },
            {
                module: 'Administración',
                key: 2,
                items: [
                    { id: 'administración-usuarios', title: 'Usuarios', href: gestionUsuarios(), icon: LayoutGrid },
                ],
            },
            {
                module: 'Seguridad',
                key: 3,
                items: [
                    { id: 'seguridad-pernocta', title: 'Pernocta del día', href: pernoctadia(), icon: LayoutGrid },
                    { id: 'seguridad-subTerraneo', title: 'Estacionamiento SubTerraneo', href: estacionamiento(), icon: LayoutGrid },
                    { id: 'seguridad-Pernocta-mes', title: 'Pernocta por Mes', href: pernoctames(), icon: LayoutGrid },
                    { id: 'seguridad-csae', title: 'Movimiento de Aviones CSAE', href: movimientoAvionesCSAE(), icon: LayoutGrid },
                    { id: 'seguridad-vehiculos', title: 'Movimientos de Vehiculos EOLO', href: movimientosVehiculoEolo(), icon: LayoutGrid },
                    { id: 'seguridad-operaciones', title: 'Operaciones Diarias', href: operacionesDiarias(), icon: LayoutGrid },
                    { id: 'seguridad-visitantes', title: 'Registro de Visitantes', href: registroVisitantes(), icon: LayoutGrid },
                ],
            },
            {
                module: 'Rampa',
                key: 4,
                items: [
                    { id: 'rampa-turno', title: 'Entrega de Turno', href: entregaTurnoR(), icon: LayoutGrid },
                    { id: 'rampa-seguridad', title: 'checkList Equipo de Seguridad', href: checkListEquipo(), icon: LayoutGrid },
                    { id: 'rampa-operaciones', title: 'Operaciones Diarias', href: operacionesDiarias(), icon: LayoutGrid },

                    {
                        id: 'rampa-combustible',
                        title: 'Combustible',
                        children: [
                            {
                                id: 'rampa-autotanque',
                                title: 'Entrega Turno',
                                href: reporteEntregaTurno(),
                                icon: LayoutGrid,
                            },
                            {
                                id: 'rampa-remision',
                                title: 'Remisión',
                                href: remision(),
                                icon: LayoutGrid,
                            },
                            {
                                id: 'rampa-combustible-inspeccion',
                                title: 'Inspección Combustible',
                                href: inspeccionCombustible(),
                                icon: LayoutGrid,
                            },
                        ],
                    },

                    { id: 'rampa-around', title: 'Walk Around', href: walkAround(), icon: LayoutGrid },
                ],
            },
            {
                module: 'Trafico',
                key: 5,
                items: [
                    { id: 'trafico-turno', title: 'Entrega de Turno', href: checkListTurno(), icon: LayoutGrid },
                    { id: 'trafico-medicamento', title: 'Control de Medicamento', href: controlMedicamento(), icon: LayoutGrid },
                    { id: 'trafico-operaciones', title: 'Operaciones Diarias', href: operacionesDiarias(), icon: LayoutGrid },
                    { id: 'trafico-comisariato', title: 'Servicio de Comisariato', href: servicioComisariato(), icon: LayoutGrid },
                    { id: 'trafico-around', title: 'Walk Around', href: walkAround(), icon: LayoutGrid },
                ],
            },
        ]
    }
    console.log(user.departamentos);

    return (user.departamentos ?? [])
        .map((dep) => {
            // 1. Mapeamos y filtramos con un Type Guard para asegurar que 'item' no sea null
            const rawItems = dep.subdepartamentos
                .map((sub) => {
                    if (!sub.route) return null;
                    const routeKey = sub.route.split('.').pop();
                    if (!routeKey || !ROUTE_CONFIG[routeKey]) return null;

                    const config = ROUTE_CONFIG[routeKey];
                    return {
                        id: `${dep.id}-${routeKey}`,
                        title: config.title,
                        href: config.href(),
                        icon: LayoutGrid,
                        routeKey: routeKey
                    };
                })
                // El predicado (item): item is NonNullable<typeof item> elimina el error TS18047
                .filter((item): item is NonNullable<typeof item> => item !== null);

            // 2. Definimos las rutas a agrupar
            const combustibleRoutes = ['reporteentregaturno', 'remision', 'inspeccioncombustible'];

            // Usamos NavItem[] para mantener la consistencia de tipos
            const finalItems: NavItem[] = [];
            const combustibleChildren: NavItem[] = [];

            rawItems.forEach(item => {
                // Aquí 'item' ya es seguro y no es null
                if (combustibleRoutes.includes(item.routeKey)) {
                    combustibleChildren.push(item);
                } else {
                    finalItems.push(item);
                }
            });

            // 3. Agrupamos si existen hijos
            if (combustibleChildren.length > 0) {
                finalItems.push({
                    id: `dep-${dep.id}-combustible`,
                    title: 'Combustible',
                    // Icono opcional para el grupo padre si lo deseas
                    icon: LayoutGrid,
                    children: combustibleChildren
                });
            }

            return {
                module: dep.nombre,
                key: dep.id,
                items: finalItems,
            };
        })
        .filter((m) => m.items.length > 0);
}
