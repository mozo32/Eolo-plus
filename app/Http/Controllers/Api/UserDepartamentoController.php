<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\SubDepartamento;
use App\Models\Departamento;
use App\Models\Role;
use Illuminate\Http\Request;

class UserDepartamentoController extends Controller
{
    public function index(User $user)
    {
        $userSubIds = $user->subdepartamentos()
            ->pluck('subdepartamentos.id')
            ->toArray();

        $departamentos = Departamento::with('subdepartamentos')
            ->get()
            ->map(function ($dep) use ($userSubIds) {
                return [
                    'id' => $dep->id,
                    'nombre' => $dep->nombre,
                    'subdepartamentos' => $dep->subdepartamentos->map(function ($sub) use ($userSubIds) {
                        return [
                            'id' => $sub->id,
                            'nombre' => $sub->nombre,
                            'activo' => in_array($sub->id, $userSubIds),
                        ];
                    }),
                ];
            });

        return response()->json([
            'departamentos' => $departamentos,
            'roles' => Role::select('id', 'slug', 'nombre')->get(),
            'userRoleId' => $user->roles()->value('roles.id'),
        ]);
    }
    public function store(Request $request, User $user)
    {
        $request->validate([
            'role_id' => ['required', 'integer', 'exists:roles,id'],
            'asignaciones' => ['required', 'array'],
            'asignaciones.*.departamento_id' => ['required', 'integer'],
            'asignaciones.*.subdepartamentos' => ['array'],
        ]);

        $subIds = collect($request->asignaciones)
            ->pluck('subdepartamentos')
            ->flatten()
            ->unique()
            ->values()
            ->toArray();

        $user->subdepartamentos()->sync($subIds);

        $depIds = SubDepartamento::whereIn('id', $subIds)
            ->pluck('departamento_id')
            ->unique()
            ->toArray();

        $user->departamentos()->sync($depIds);

        $user->roles()->sync([$request->role_id]);

        return response()->json([
            'message' => 'Asignaciones y rol guardados correctamente',
        ]);
    }
}
