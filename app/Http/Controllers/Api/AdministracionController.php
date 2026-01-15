<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;

class AdministracionController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        if (! $user || ! $user->hasRole('admin')) {
            abort(403, 'No autorizado');
        }

        $search   = $request->input('search');
        $perPage  = $request->integer('per_page', 10);
        $sortBy   = $request->input('sort_by', 'name');
        $sortDir  = $request->input('sort_dir', 'asc');

        $query = User::query()
            ->select('users.id', 'users.name', 'users.email', 'users.created_at')
            ->where('users.id', '!=', $user->id)
            ->with('roles:id,slug,nombre');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('users.name', 'like', "%{$search}%")
                  ->orWhere('users.email', 'like', "%{$search}%");
            });
        }
        $allowedSorts = ['name', 'email', 'created_at'];

        if (! in_array($sortBy, $allowedSorts)) {
            $sortBy = 'name';
        }

        $query->orderBy($sortBy, $sortDir === 'desc' ? 'desc' : 'asc');

        $users = $query->paginate($perPage)->withQueryString();

        return response()->json($users);
    }
}
