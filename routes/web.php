<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

Route::get('/', function () {
    return Inertia::render('welcome', [
        'canRegister' => Features::enabled(Features::registration()),
    ]);
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('walkAround', function () {
        return Inertia::render('despacho/WalkAround');
    })->name('walkAround')->middleware('subdep:walkAround');

    Route::get('entregaTurno', function () {
        return Inertia::render('despacho/EntregaTurno');
    })->name('entregaTurno')->middleware('subdep:entregaTurno');

    Route::get('gestionarAeronaves', function () {
        return Inertia::render('despacho/GestionAeronaves');
    })->name('gestionarAeronaves');

    //administración
    Route::get('gestionUsuarios', function () {
        return Inertia::render('administracion/GestionUsuarios');
    })->name('gestionUsuarios');

    Route::get('pernoctadia', function () {
        return Inertia::render('seguridad/PernoctaDia');
    })->name('pernoctadia');

    Route::get('pernoctames', function () {
        return Inertia::render('comercial/PernoctaMes');
    })->name('pernoctames');
});

require __DIR__.'/settings.php';
