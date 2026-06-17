import { useEffect, useMemo, useState, useCallback } from "react";
import { usePage } from '@inertiajs/react';
import AppLayout from "@/layouts/app-layout";
import { walkAround } from "@/routes";
import { type BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";
import Swal from "sweetalert2";
import { fetchWalkarounds, WalkAroundRow } from "@/stores/apiWalkaround";
import TablaWalkAround from "./componentes2/TablaWalkAround";
type LaravelLink = {
    url: string | null;
    label: string;
    active: boolean;
};

type LaravelMeta = {
    current_page: number;
    last_page: number;
    per_page?: number;
    total?: number;
};
type Role = {
    slug: string;
    nombre: string;
};

export type AuthUser = {
    id: number;
    name: string;
    email: string;

    isAdmin: boolean;
    roles: Role[];
};
type PageProps = {
    auth: {
        user: AuthUser | null;
    };
};
type Paginated<T> = {
    data: T[];
    links?: LaravelLink[];
    meta?: LaravelMeta;
};

function useDebounce<T>(value: T, delay = 350) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);

    return debounced;
}

function normalizeLabel(label: string) {
    const clean = label
        .replace(/&laquo;|«/g, "")
        .replace(/&raquo;|»/g, "")
        .replace(/&amp;/g, "&")
        .trim();

    if (clean.toLowerCase().includes("previous")) return "←";
    if (clean.toLowerCase().includes("next")) return "→";
    return clean;
}

export default function WalkAround() {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user;

    const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
        if (!user) {
            return [{ title: "WalkAround" }];
        }

        const roleLabels: Record<string, string> = {
            admin: "Administrador",
            empleado: "Empleado",
            jefe_area: "Jefe de Área",
            fbo: "FBO",
        };

        const roleName =
            user.roles
                .map((r) => roleLabels[r.slug] ?? r.nombre)
                .join(", ");

        return [
            {
                title: roleName
                    ? `WalkAround · ${roleName}`
                    : "WalkAround",
            },
        ];
    }, [user]);
    const [rows, setRows] = useState<WalkAroundRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [pdfId, setPdfId] = useState<number | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(false);
    // filtros + paginación
    const [q, setQ] = useState("");
    const debouncedQ = useDebounce(q, 350);
    const [page, setPage] = useState(1);

    const [meta, setMeta] = useState<LaravelMeta | undefined>(undefined);
    const [links, setLinks] = useState<LaravelLink[]>([]);
    const roleLabels2: Record<string, string> = {
        admin: "Administrador",
        empleado: "Empleado",
        jefe_area: "Jefe de Área",
        fbo: "FBO",
    };
    const userRol =
        user?.roles
            .map((r) => roleLabels2[r.slug] ?? r.nombre)
            .join(", ");

    // modal registrar
    const [isModalOpen, setIsModalOpen] = useState(false);

    // modal detalle
    const [detalleId, setDetalleId] = useState<number | null>(null);
    const [detalleOpen, setDetalleOpen] = useState(false);

    // modal editar
    const [editId, setEditId] = useState<number | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    const [firmId, setFirmId] = useState<number | null>(null);
    const [firmOpen, setFirmOpen] = useState(false);

    // modal basurero
    const [basuOpen, setBasuOpen] = useState(false);

    // modal bitacora
    const [bitacoraOpen, setBitacoraOpen] = useState(false);

    const [filters, setFilters] = useState({
        movimiento: "",
        tipo: "",
        fecha_inicio: "",
        fecha_fin: "",
    });
    const handlePdfDone = useCallback(() => {
        setPdfId(null);
    }, []);
    const load = async (opts?: { q?: string; page?: number }) => {
        const nextQ = opts?.q ?? debouncedQ;
        const nextPage = opts?.page ?? page;

        setLoading(true);
        try {
            const res = (await fetchWalkarounds({
                q: nextQ,
                page: nextPage,
                ...filters,
            })) as Paginated<WalkAroundRow> | WalkAroundRow[];

            if (Array.isArray((res as any)?.data)) {
                const p = res as Paginated<WalkAroundRow>;
                setRows(p.data ?? []);
                setMeta(p.meta);
                setLinks(p.links ?? []);
            } else {
                setRows(res as WalkAroundRow[]);
                setMeta(undefined);
                setLinks([]);
            }
        } catch (e: any) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: e?.message || "No se pudo cargar la información",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load({ q: debouncedQ, page });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedQ, page]);

    // si cambia filtro, vuelve a página 1
    useEffect(() => {
        setPage(1);
    }, [debouncedQ]);

    const pageLabel = useMemo(() => {
        if (!meta) return null;
        return `Página ${meta.current_page} de ${meta.last_page}${meta.total ? ` · ${meta.total} registros` : ""
            }`;
    }, [meta]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="WalkAround" />

            <TablaWalkAround />
        </AppLayout>
    );
}
