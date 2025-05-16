// src/network/SocketManager.ts
import { io, Socket } from 'socket.io-client';

type Region = 'NA' | 'EU' | 'ASIA' | 'GLOBAL';

export class SocketManager {
  private socket: Socket;

  constructor(serverUrl: string) {
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'] // Prefer WebSocket, fallback to polling
  });

    this.socket.on('connect', () => {
      console.log('[SocketManager] Connected:', this.socket.id);
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

  joinQueue(region: Region, name: string) {
    console.log(`[SocketManager] Joining queue in ${region}...`);
    this.socket.emit('joinQueue', { region, name });
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket.on(event, callback);
  }

  emit(event: string, payload?: any) {
    this.socket.emit(event, payload);
  }
a 
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
