<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('notas_operacionales', function (Blueprint $table) {
            $table->id();

            // Contenido de la nota
            $table->text('descripcion');

            // Relación con Departamentos y Subdepartamentos (Módulos)
            $table->foreignId('departamento_id')
                  ->constrained('departamentos')
                  ->onDelete('cascade');

            $table->foreignId('subdepartamento_id')
                  ->nullable() // Se queda nullable por si se crea una nota general para todo el departamento
                  ->constrained('subdepartamentos')
                  ->onDelete('cascade');

            // Relaciones con la tabla de usuarios
            $table->foreignId('creado_por_user_id')
                  ->constrained('users')
                  ->onDelete('cascade');

            $table->foreignId('validado_por_user_id')
                  ->nullable() // Nulo al principio, se llena cuando el Jefe/FBO valida
                  ->constrained('users')
                  ->onDelete('set null');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notas_operacionales');
    }
};
