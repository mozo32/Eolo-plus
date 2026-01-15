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
        Schema::create('aeronaves', function (Blueprint $table) {
            $table->id();

            $table->string('matricula', 50);
            
            $table->unsignedBigInteger('aeronave_id');
            $table->foreign('aeronave_id')
                ->references('id')
                ->on('tipo_aeronaves')
                ->onDelete('cascade');

            $table->string('tipo_aeronave')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('aeronaves');
    }
};
