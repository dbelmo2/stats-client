// src/network/SocketManager.ts
import { io, Socket } from 'socket.io-client';

type Region = 'NA' | 'EU' | 'ASIA' | 'GLOBAL';

export class SocketManager {
  private socket: Socket;
  private pingHistory: number[] = [];
  private currentPing: number = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(serverUrl: string) {
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'], // Prefer WebSocket, fallback to polling
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    this.setupPingMonitoring();

    this.socket.on('connect', () => {
      console.log('[SocketManager] Connected:', this.socket.id);
      console.log('[SocketManager] Connected:', this.socket.id);
      console.log('[SocketManager] Transport:', this.socket.io.engine.transport.name);
      
      // Log when transport changes (e.g., from polling to websocket)
      this.socket.io.engine.on('upgrade', (transport) => {
        console.log(`[SocketManager] Transport upgraded from ${this.socket.io.engine.transport.name} to ${transport}`);
      });
    });

    this.socket.on('queued', ({ region }) => {
      console.log(`[SocketManager] Queued in region: ${region}`);
    });

    this.socket.on('matchFound', ({ matchId, region }) => {
      console.log(`[SocketManager] Match found: ${matchId} in ${region}`);
    });

    this.socket.on('movedToGlobalQueue', () => {
      console.log(`[SocketManager] Moved to global queue`);
    });
  }

  private setupPingMonitoring(): void {
      // Start measuring ping every 2 seconds
      this.pingInterval = setInterval(() => {
          const start = Date.now();
          
          // Use volatile to prevent buffering if disconnected
          this.socket.volatile.emit('ping', () => {
              const latency = Date.now() - start;
              this.updatePing(latency);
          });
      }, 2000);
      
      // Clean up on disconnect
      this.socket.on('disconnect', () => {
          if (this.pingInterval) {
              clearInterval(this.pingInterval);
              this.pingInterval = null;
          }
      });
  }

  private updatePing(latency: number): void {
      // Add to history (keep last 5 values)
      this.pingHistory.push(latency);
      if (this.pingHistory.length > 5) {
          this.pingHistory.shift();
      }
      
      // Calculate average ping
      this.currentPing = Math.round(
          this.pingHistory.reduce((sum, val) => sum + val, 0) / this.pingHistory.length
      );
      
      // Emit ping update event
      this.socket.emit('client_ping_update', this.currentPing);
  }

  // Add getter for current ping
  public getPing(): number {
      return this.currentPing;
  }

  joinQueue(region: Region, name: string) {
    console.log(`[SocketManager] Joining queue in ${region}...`);
    this.socket.emit('joinQueue', { region, name });
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket.on(event, callback);
  }

  emit(event: string, payload?: unknown) {
    this.socket.emit(event, payload);
  }

  disconnect() {
    this.socket.disconnect();
  }

  once(event: string, callback: (...args: any[]) => void) {
    this.socket.once(event, callback);
  }

  public getId() {
    console.log('returning this.socket.id', this.socket.id);
    return this.socket.id;
  }
  
  public async waitForConnect(): Promise<void> {
    if (this.socket.connected) return;
  
    return new Promise(resolve => {
      this.socket.on('connect', () => resolve());
    });
  }
}
