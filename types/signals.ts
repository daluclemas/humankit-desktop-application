export type SignalStatus = 'not-connected' | 'waiting' | 'available' | 'unavailable'
export interface SignalProvider { start(): Promise<void>; stop(): Promise<void> }
export interface SignalSnapshot { status: SignalStatus; value?: number; timestamp: number }
