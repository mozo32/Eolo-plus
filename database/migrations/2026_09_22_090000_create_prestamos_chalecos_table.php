<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Préstamos de chaleco al personal visitante.
 *
 * La fotografía de la INE se guarda como una fila de `imagens` en disco
 * privado; aquí solo vive la referencia, porque cada préstamo tiene una sola.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prestamos_chalecos', function (Blueprint $table) {
            $table->id();
            $table->date('fecha')->index();
            $table->string('nombre_recibe', 120);

            // Quien entrega el chaleco (personal de Tráfico).
            $table->foreignId('usuario_entrega_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('foto_ine_imagen_id')->nullable()->constrained('imagens')->nullOnDelete();

            $table->string('estado', 12)->default('prestado')->index();
            $table->dateTime('fecha_devolucion')->nullable();
            $table->foreignId('devuelto_por_user_id')->nullable()->constrained('users')->nullOnDelete();

            // Auditoría: quién capturó el registro.
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prestamos_chalecos');
    }
};
