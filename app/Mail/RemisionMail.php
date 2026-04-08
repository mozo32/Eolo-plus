<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use App\Models\Remision;

class RemisionMail extends Mailable
{
    use Queueable, SerializesModels;

    public $remision;

    public function __construct(Remision $remision)
    {
        $this->remision = $remision;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Nueva Remisión: ' . $this->remision->folio,
        );
    }

    public function content(): Content
    {
        return new Content(
            // CAMBIO AQUÍ: Debe coincidir con la ubicación de tu archivo blade
            view: 'emails.remision',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
