// src/managers/NetworkManager.ts
import { io, Socket } from 'socket.io-client';
import { ModalManager } from '../components/ui/Modal';
import { ErrorHandler, ErrorType } from '../utils/ErrorHandler';


export interface InitializationOptions {
  serverUrl: string;
  region: string;
  playerName: string;
}

export interface MatchData {
  matchId: string;
  region: string;
  playerId: string;
}

export class NetworkManager {
    private static instance: NetworkManager;
    private socket: Socket | null = null;
    private pingHistory: number[] = [];
    private currentPing: number = 0;
    private pingIntervalId: ReturnType<typeof setInterval> | null = null;
    private playerId: string | undefined;

    private currentMatchData: MatchData | null = null;

    private readonly PING_INTERVAL_MS = 1000;
    private isWaitingForPong: boolean = false;

    private constructor() {
      // Private constructor for singleton pattern
    }

    public static getInstance(): NetworkManager {
      if (!NetworkManager.instance) {
        NetworkManager.instance = new NetworkManager();
      }
      return NetworkManager.instance;
    }

    public static cleanup(): void {
      if (NetworkManager.instance) {
        NetworkManager.instance.cleanup();
        NetworkManager.instance = null as any;
      }
    }

    public async initialize({ serverUrl, region, playerName }: InitializationOptions): Promise<MatchData> {
        console.log(`[NetworkManager] Initializing with serverUrl: ${serverUrl}, region: ${region}, playerName: ${playerName}`);
        if (this.currentMatchData) {
          console.warn('NetworkManager already initialized');
          return this.currentMatchData as MatchData;
        }
        
        this.socket = io(serverUrl, {
          transports: ['websocket'], // Prefer WebSocket, fallback to polling
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 20000,
          upgrade: false,
        });

        await this.waitForConnect();
        console.log('[NetworkManager] Connected to server');
        window.addEventListener('beforeunload', () => {
          this.cleanup();
        });

        this.setupPingMonitoring();
        console.log('[NetworkManager] Ping monitoring set up');
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
        });

        this.socket.once('rejoinedMatch', this.handleSuccessfulRejoin);
        this.socket.on('afkWarning', this.handleAfkWarning);

        this.joinQueue(playerName, region);

        const matchData = await this.waitForMatchFound();
        this.currentMatchData = matchData;
        this.playerId = matchData.playerId;

        this.socket.on('disconnect', (reason) => this.handleConnectionLost(reason, playerName, region));

        return matchData;
    }


    private waitForMatchFound(): Promise<MatchData> {
      return new Promise((resolve) => {
        if (!this.socket) {
          console.error('NetworkManager not initialized');
          return;
        }

        this.socket.once('matchFound', (matchData: MatchData) => {
          console.log('Match found:', matchData);
          resolve(matchData);
        });
      });
    }

    private handleConnectionLost = (reason: string, playerName: string, playerRegion: string) => {
        if (!this.socket) {
            console.error('NetworkManager not initialized');
            return;
        }

        if (reason === "io server disconnect") {
            this.handleAfkRemoved({ message: 'You were removed for being AFK.' });
        } else {
            console.log('Unexpected disconnection, attempting to reconnect...');
            this.handleDisconnectedWarning();
            this.socket.once('connect', () => this.handleReconnection(playerName, playerRegion));
        }
    }

    private handleReconnection = async (playerName: string, playerRegion: string) => {
        if (!this.socket) {
            console.error('NetworkManager not initialized');
            return;
        }

        console.log('Reconnected to server, rejoining queue...');
        this.joinQueue(playerName, playerRegion);
    }

    private handleDisconnectedWarning = () => {
        ModalManager.getInstance().showModal({
            title: "Connection Lost",
            message: "Connection lost. Attempting to reconnect...",
            isWarning: true
        });
    }

    private handleAfkRemoved = ({ message }: { message: string}) => {
        try {
            ModalManager.getInstance().showModal({
                title: "Removed for Inactivity",
                message: "You have been removed from the game due to inactivity. Reload the page to rejoin.",
                button: {
                    text: "Reload Page",
                    action: () => {
                        window.location.reload();
                    },
                    closeOnClick: false
                },
                isWarning: true
            });
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.SOCKET,
                { event: 'afkRemoved', message }
            );
            // Fallback: if modal fails, still try to reload
            setTimeout(() => window.location.reload(), 3000);
        }
    }

    private handleAfkWarning = ({ message }: { message: string}) => {
        try {
            console.warn(`[SocketManager] AFK Warning: ${message}`);
            ModalManager.getInstance().showModal({
                title: "AFK Warning",
                message: "You have been inactive for too long. Please move or click to continue playing.",
                button: {
                    text: "OK",
                    closeOnClick: true
                },
                isWarning: true
            });
        } catch (error) {
            ErrorHandler.getInstance().handleError(
                error as Error,
                ErrorType.SOCKET,
                { event: 'afkWarning', message }
            );
        }
    }


    private setupPingMonitoring(): void {
        if (!this.socket) {
            console.error('NetworkManager not initialized');
            return;
        }

        // Start measuring ping every 1 second
        if (this.pingIntervalId) clearInterval(this.pingIntervalId);
    
        this.pingIntervalId = setInterval(() => {
            if (this.isWaitingForPong === true) return;
            const start = Date.now();
            // Use volatile to prevent buffering if disconnected
            if (this.socket) {
                this.socket.emit('m-ping', { pingStart: start });
            }
            this.isWaitingForPong = true;
        }, this.PING_INTERVAL_MS);

        this.socket.on('m-pong', ({ pingStart }) => {
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
        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.disconnect();
        }
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
    }

    // Add getter for current ping
    public getPing(): number {
        return this.currentPing;
    }

    joinQueue(name: string, region: string) {
      console.log(`[NetworkManager] Joining queue in region: ${region} as ${name}`);
      if (!this.socket) {
        console.error('NetworkManager not initialized');
        return;
      }
      this.socket.emit('joinQueue', { region, name });
      console.log('[NetworkManager] joinQueue event emitted');
    }

    on(event: string, callback: (...args: any[]) => void) {
      if (!this.socket) {
        console.error('NetworkManager not initialized');
        return;
      }
      this.socket.on(event, callback);
    }

    emit(event: string, payload?: unknown) {
      if (!this.socket) {
        console.error('NetworkManager not initialized');
        return;
      }
      this.socket.emit(event, payload);
    }

    disconnect() {
      if (!this.socket) {
        console.error('NetworkManager not initialized');
        return;
      }
      this.socket.disconnect();
    }

    once(event: string, callback: (...args: any[]) => void) {
      if (!this.socket) {
        console.error('NetworkManager not initialized');
        return;
      }
      this.socket.once(event, callback);
    }

    public getPlayerId() {
      if (!this.socket) {
        console.error('NetworkManager not initialized');
        return null;
      }

      return this.playerId;
    }

    public isConnected(): boolean {
      return this.socket?.connected || false;
    }

    public getSocket(): Socket | null {
      return this.socket;
    }


    public async waitForConnect(): Promise<void> {
      if (!this.socket) {
        throw new Error('NetworkManager not initialized');
      }
      if (this.socket.connected && this.playerId) return;
      return new Promise(resolve => {
        this.socket!.once('connect', () => {
          resolve();
        });
      });
    }



    private async handleSuccessfulRejoin() {
      try {
          ModalManager.getInstance().closeModal();
      } catch (error) {
          ErrorHandler.getInstance().handleError(
              error as Error, 
              ErrorType.RENDERING,
              { event: 'successfulRejoin' }
          );
      }   
  }
}
