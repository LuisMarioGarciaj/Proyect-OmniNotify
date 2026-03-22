// src/modules/notifications/backoff.strategy.ts
//
// ═══════════════════════════════════════════════════════════════════════════
// CÓMO FUNCIONA:
//
// El servicio pasa el delay en ms como primer elemento del array opts.delay.
// Formato: backoff: { type: 'custom', delay: delayMs }
//
// BullMQ llama a esta función con (attemptsMade, type, opts) donde opts es el
// objeto backoff del job. Retornamos opts.delay (el valor que el usuario eligió).
//
// Resultado: si el usuario pide retryIntervalMinutes: 5 → 5 minutos entre reintentos.
// El intervalo es FIJO (no exponencial), igual para todos los intentos.
//
// REGISTRAR EN app.module.ts:
//   import { notificationBackoffStrategy } from './modules/notifications/backoff.strategy';
//
//   BullModule.forRootAsync({
//     useFactory: (config) => ({
//       connection: { ... },
//       extraOptions: {
//         customBackoffStrategies: {
//           custom: notificationBackoffStrategy,
//         },
//       },
//     }),
//   })
// ═══════════════════════════════════════════════════════════════════════════

export function notificationBackoffStrategy(
    _attemptsMade: number,
    _type: string,
    opts: { delay?: number },
): number {
    // Si el job tiene un delay configurado (viene de resend.retryIntervalMinutes),
    // usarlo directamente. Fallback: 60 segundos.
    const delay = opts?.delay;

    if (typeof delay === 'number' && delay > 0) {
        return delay;
    }

    return 60_000; // 1 minuto por defecto
}