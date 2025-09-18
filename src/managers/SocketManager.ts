// src/network/SocketManager.ts
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
export class SocketManager {
  private socket: Socket;
  private pingHistory: number[] = [];
  private currentPing: number = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private playerId: string | null = uuidv4();
  
  constructor(serverUrl: string) {
    this.socket = io(serverUrl, {
      transports: ['websocket'], // Prefer WebSocket, fallback to polling
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      upgrade: false,
      auth: {
        uuid: this.playerId
      }
    });


    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    this.setupPingMonitoring();


    this.socket.on('connect', () => {
      console.log('[SocketManager] Connected:', this.socket.id);
      console.log('[SocketManager] Transport:', this.socket.io.engine.transport.name);
      
      // Log when transport changes (e.g., from polling to websocket)
      this.socket.io.engine.on('upgrade', (transport) => {
        console.log(`[SocketManager] Transport upgraded from ${this.socket.io.engine.transport.name} to ${transport}`);
      });
    });


    this.socket.on('connect_error', (err) => {
      console.error('[SocketManager] Connection error:', err.message);
    });
  
    this.socket.on('disconnect', (reason) => {
      console.warn(`[SocketManager] Disconnected: ${reason}`);
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
    
    this.socket.on('afkWarning', ({ message }) => {
      console.warn(`[SocketManager] AFK Warning: ${message}`);
    });

    this.socket.on('afkRemoved', ({ message }) => {
      console.warn(`[SocketManager] AFK Removed: ${message}`);
    })
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

      // Clean up on AFK removal
      this.socket.on('afkRemoved', () => {
          if (this.pingInterval) {
              clearInterval(this.pingInterval);
              this.pingInterval = null;
          }
      });
  }



  public cleanup(): void {
      if (this.pingInterval) {
          clearInterval(this.pingInterval);
          this.pingInterval = null;
      } 
      this.socket.removeAllListeners();
      this.socket.disconnect();
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

  joinQueue(name: string, region: string) {
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

  public getPlayerId() {
    return this.playerId;
  }


  public async waitForConnect(): Promise<void> {
    if (this.socket.connected) return;
    return new Promise(resolve => {
      this.socket.once('connect', () => resolve()); 
    });
  }
}
