import { dashboard,
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

export type NavModule = {
    module: string
    key: number
    items: {
        id: string
        title: string
        href: Href
        moduleKey?: number
        icon?: any
    }[]
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
    entregaturnor: {
        href: entregaTurnoR,
        title: 'Entrega de Turno de Rampa',
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
        title: 'CheckList de Turno',
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
                    { id: 'despacho-around',title: 'Walk Around', href: walkAround(), icon: LayoutGrid },
                    { id: 'despacho-turno',title: 'Entrega Turno', href: entregaTurno(), icon: LayoutGrid },
                    { id: 'despacho-aeronaves',title: 'Gestionar Aeronaves', href: gestionarAeronaves(), icon: LayoutGrid },
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
                ],
            },
            {
                module: 'Rampa',
                key: 4,
                items: [
                    { id: 'rampa-turno', title: 'Entrega Turno de Rampa', href: entregaTurnoR(), icon: LayoutGrid },
                    { id: 'rampa-personal', title: 'Asistencia de Personal', href: asistenciaPersonal(), icon: LayoutGrid },
                    { id: 'rampa-seguridad', title: 'checkList Equipo de Seguridad', href: checkListEquipo(), icon: LayoutGrid },
                    { id: 'rampa-operaciones', title: 'Operaciones Diarias', href: operacionesDiarias(), icon: LayoutGrid },
                ],
            },
            {
                module: 'Trafico',
                key: 5,
                items: [
                    { id: 'trafico-turno', title: 'checkList de Turno', href: checkListTurno(), icon: LayoutGrid },
                    { id: 'trafico-medicamento', title: 'Control de Medicamento', href: controlMedicamento(), icon: LayoutGrid },
                    { id: 'trafico-operaciones', title: 'Operaciones Diarias', href: operacionesDiarias(), icon: LayoutGrid },
                    { id: 'trafico-comisariato', title: 'Servicio de Comisariato', href: servicioComisariato(), icon: LayoutGrid },
                ],
            },
        ]
    }

    return (user.departamentos ?? [])
        .map((dep) => {
            const items = dep.subdepartamentos
                .map((sub) => {
                    if (!sub.route) return null
                    const routeKey = sub.route.split('.').pop()
                    if (!routeKey || !ROUTE_CONFIG[routeKey]) return null

                    const config = ROUTE_CONFIG[routeKey]

                    return {
                        title: config.title,
                        href: config.href(),
                        icon: LayoutGrid,
                        moduleKey: dep.id,
                    }
                })
                .filter(Boolean) as NavModule['items']

            return {
                module: dep.nombre,
                key: dep.id,
                items,
            }
        })
        .filter((m) => m.items.length > 0)
}
