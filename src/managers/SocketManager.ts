// src/network/NetworkManager.ts
import { io, Socket } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
export class NetworkManager {
  private socket: Socket;
  private pingHistory: number[] = [];
  private currentPing: number = 0;
  private pingIntervalId: ReturnType<typeof setInterval> | null = null;
  private playerId: string | null = uuidv4();

  private readonly PING_INTERVAL_MS = 1000;
  private isWaitingForPong: boolean = false;


  
  constructor(serverUrl: string) {
    this.socket = io(serverUrl, {
      transports: ['websocket'], // Prefer WebSocket, fallback to polling
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      upgrade: false,
      auth: {
        uuid: this.playerId // TODO: Why are we sending this client side? is it to help with reconnections? Can we have it generated server side?
      }
    });


    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    this.setupPingMonitoring();


    this.socket.on('connect', () => {
      console.log('[NetworkManager] Connected:', this.socket.id);
      console.log('[NetworkManager] Transport:', this.socket.io.engine.transport.name);
      
      // Log when transport changes (e.g., from polling to websocket)
      this.socket.io.engine.on('upgrade', (transport) => {
        console.log(`[NetworkManager] Transport upgraded from ${this.socket.io.engine.transport.name} to ${transport}`);
      });
    });


    this.socket.on('connect_error', (err) => {
      console.error('[NetworkManager] Connection_error event:', err.message);
    });
  
  
    this.socket.on('disconnect', (reason) => {
      console.warn(`[NetworkManager] Disconnected: ${reason}`);
    });

    this.socket.on('queued', ({ region }) => {
      console.log(`[NetworkManager] Queued in region: ${region}`);
    });

    this.socket.on('matchFound', ({ matchId, region }) => {
      console.log(`[NetworkManager] Match found: ${matchId} in ${region}`);
    });

    this.socket.on('movedToGlobalQueue', () => {
      console.log(`[NetworkManager] Moved to global queue`);
    });
    
    this.socket.on('afkWarning', ({ message }) => {
      console.warn(`[NetworkManager] AFK Warning: ${message}`);
    });

    this.socket.on('afkRemoved', ({ message }) => {
      console.warn(`[NetworkManager] AFK Removed: ${message}`);
    })
  }






  private setupPingMonitoring(): void {
      // Start measuring ping every 1 second
      if (this.pingIntervalId) clearInterval(this.pingIntervalId);

      this.pingIntervalId = setInterval(() => {
        console.log('Ping interval triggered, waiting for pong:', this.isWaitingForPong);
          if (this.isWaitingForPong === true) return;
          const start = Date.now();
          console.log('Sending ping at', start);
          // Use volatile to prevent buffering if disconnected
          this.socket.emit('m-ping', { pingStart: start });
          this.isWaitingForPong = true;
      }, this.PING_INTERVAL_MS);

      this.socket.on('m-pong', ({ pingStart }) => {
        console.log('Received m-pong for ping started at', pingStart);
          this.isWaitingForPong = false;
          const latency = Date.now() - pingStart;
          this.updatePing(latency);
      });

      // Clean up on AFK removal
      this.socket.on('afkRemoved', () => {
          if (this.pingIntervalId) {
              clearInterval(this.pingIntervalId);
              this.pingIntervalId = null;
          }
      });
  }



  public cleanup(): void {
      if (this.pingIntervalId) {
          clearInterval(this.pingIntervalId);
          this.pingIntervalId = null;
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
      console.log(`Ping history length: ${this.pingHistory.length}, Latest ping: ${latency}ms`);
      // Calculate average ping
      this.currentPing = Math.round(
          this.pingHistory.reduce((sum, val) => sum + val, 0) / this.pingHistory.length
      );
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
