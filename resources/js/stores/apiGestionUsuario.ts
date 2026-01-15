export type SubDepartamentoApi = {
    id: number;
    nombre: string;
    activo: boolean;
};

export type DepartamentoApi = {
    id: number;
    nombre: string;
    subdepartamentos: SubDepartamentoApi[];
};

export type RoleApi = {
    id: number;
    slug: string;
    nombre: string;
};
export type SaveDepartamentosUsuarioPayload = {
    role_id: number;
    asignaciones: {
        departamento_id: number;
        subdepartamentos: number[];
    }[];
};
async function handleResponse(res: Response) {
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data?.message || 'Error en la petición');
    }

    return data;
}

export async function fetchUsers(params: any = {}) {
    const qs = new URLSearchParams(params);

    const res = await fetch(`/api/administracion/users?${qs.toString()}`, {
        headers: {
            Accept: 'application/json',
        },
        credentials: 'include',
    });

    return handleResponse(res);
}

export type FetchDepartamentosUsuarioResponse = {
    departamentos: DepartamentoApi[];
    roles: RoleApi[];
    userRoleId: number | null;
};

export async function fetchDepartamentosUsuario(
    userId: number
): Promise<FetchDepartamentosUsuarioResponse> {
    const res = await fetch(
        `/api/administracion/users/${userId}/departamentos`,
        {
            headers: {
                Accept: 'application/json',
            },
            credentials: 'include',
        }
    );

    return handleResponse(res);
}

function getXsrfToken(): string {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));

    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

export async function saveDepartamentosUsuario(
    userId: number,
    payload: SaveDepartamentosUsuarioPayload
): Promise<void> {

    await fetch('/sanctum/csrf-cookie', {
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    const xsrf = getXsrfToken();

    const res = await fetch(
        `/api/administracion/users/${userId}/departamentos`,
        {
            method: 'POST',
            credentials: 'include',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-XSRF-TOKEN': xsrf,
            },
            body: JSON.stringify(payload),
        }
    );

    if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.message || 'Error al guardar');
    }
}
