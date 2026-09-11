<?php

use Inertia\Testing\AssertableInertia as Assert;

/*
 * La vista para televisión es de solo lectura y no tiene navegación, pero sigue
 * siendo una pantalla protegida: quitar el menú no la vuelve pública.
 */

test('un invitado no puede abrir la vista para pantalla', function () {
    $this->get(route('pantallaProgramadas'))->assertRedirect(route('login'));
});

test('la vista para pantalla renderiza su propio componente, sin el administrativo', function () {
    $this->actingAs(usuarioConSubdepartamento());

    $this->get(route('pantallaProgramadas'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('despacho/PantallaOperacionesProgramadas'));
});

test('un usuario de Rampa puede verla aunque no administre Operaciones Programadas', function () {
    // Es justo el punto de la vista: Rampa y Tráfico la consultan sin tener el
    // subdepartamento de Despacho.
    $this->actingAs(usuarioSinAcceso());

    $this->get(route('pantallaProgramadas'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('despacho/PantallaOperacionesProgramadas'));
});

test('la pantalla administrativa sigue siendo la de siempre', function () {
    $this->actingAs(usuarioConSubdepartamento());

    $this->get(route('operacionesProgramadas'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('despacho/OperacionesProgramadas'));
});

test('la vista para pantalla lee los mismos datos que el tablero: solo las activas de hoy', function () {
    $this->actingAs(usuarioAdmin());

    $hoy = Illuminate\Support\Carbon::now(config('app.timezone'))->toDateString();

    $activa = App\Models\OperacionProgramada::create([
        'fecha' => $hoy,
        'tipo' => 'salida',
        'matricula' => 'XA-ACTIVA',
        'equipo' => 'C172',
        'hora' => '23:50',
        'status' => App\Models\OperacionProgramada::STATUS_ACTIVA,
    ]);

    App\Models\OperacionProgramada::create([
        'fecha' => $hoy,
        'tipo' => 'salida',
        'matricula' => 'XA-REALIZADA',
        'equipo' => 'C172',
        'hora' => '08:00',
        'status' => App\Models\OperacionProgramada::STATUS_REALIZADA,
    ]);

    App\Models\OperacionProgramada::create([
        'fecha' => $hoy,
        'tipo' => 'llegada',
        'matricula' => 'XA-CANCELADA',
        'equipo' => 'C172',
        'hora' => '09:00',
        'status' => App\Models\OperacionProgramada::STATUS_CANCELADA,
    ]);

    // La hora futura no filtra: 23:50 se sigue mostrando.
    $this->getJson("/api/OperacionesProgramadas?fecha={$hoy}")
        ->assertOk()
        ->assertJsonCount(1, 'salidas')
        ->assertJsonCount(0, 'llegadas')
        ->assertJsonPath('salidas.0.matricula', $activa->matricula);
});
