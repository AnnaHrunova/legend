export function track(eventName: string, properties?: Record<string, unknown>): void {
  console.log('[analytics]', eventName, properties ?? {});
}
