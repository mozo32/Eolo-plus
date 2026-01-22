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
        title: string
        href: Href
        moduleKey?: number
        icon?: any
    }[]
}

const ROUTE_MAP: Record<string, () => Href> = {
    entregaturno: entregaTurno,
    walkaround: walkAround,
    usuarios: gestionUsuarios,
    pernoctadia: pernoctadia,
    pernoctames: pernoctames
}

export function getNavModules(user: AuthUser | null): NavModule[] {
    if (!user) return []

    if (user.isAdmin) {
        return [
            {
                module: 'Despacho',
                key: 1,
                items: [
                    { title: 'Dashboard', href: dashboard(), icon: LayoutGrid },
                    { title: 'Walk Around', href: walkAround(), icon: LayoutGrid },
                    { title: 'Entrega Turno', href: entregaTurno(), icon: LayoutGrid },
                    { title: 'Gestionar Aeronaves', href: gestionarAeronaves(), icon: LayoutGrid },
                ],
            },
            {
                module: 'Administración',
                key: 2,
                items: [
                    { title: 'Usuarios', href: gestionUsuarios(), icon: LayoutGrid },
                ],
            },
            {
                module: 'Seguridad',
                key: 3,
                items: [
                    { title: 'Pernocta del día', href: pernoctadia(), icon: LayoutGrid },
                    { title: 'Estacionamiento SubTerraneo', href: estacionamiento(), icon: LayoutGrid },
                    { title: 'Pernocta por Mes', href: pernoctames(), icon: LayoutGrid },
                ],
            },
            {
                module: 'Rampa',
                key: 4,
                items: [
                    { title: 'Entrega Turno de Rampa', href: entregaTurnoR(), icon: LayoutGrid },
                    { title: 'Asistencia de Personal', href: asistenciaPersonal(), icon: LayoutGrid },
                    { title: 'checkList Equipo de Seguridad', href: checkListEquipo(), icon: LayoutGrid },
                ],
            },
            {
                module: 'Trafico',
                key: 5,
                items: [
                    { title: 'checkList de Turno', href: checkListTurno(), icon: LayoutGrid },
                    { title: 'Control de Medicamento', href: controlMedicamento(), icon: LayoutGrid },
                    { title: 'Operaciones Diarias', href: operacionesDiarias(), icon: LayoutGrid },
                    { title: 'Servicio de Comisariato', href: servicioComisariato(), icon: LayoutGrid },
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
                    if (!routeKey || !ROUTE_MAP[routeKey]) return null

                    return {
                        title: sub.nombre,
                        href: ROUTE_MAP[routeKey](),
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
