import { EventEmitter } from 'events';
import { Socket } from 'net';
import { BrainwaveData } from '@shared/schema';

export interface NeuroSkyConfig {
  host?: string;
  port?: number;
  appName?: string;
  appKey?: string;
  autoConnect?: boolean;
  demoMode?: boolean;
  enableRawOutput?: boolean;
}

export class NeuroSkyService extends EventEmitter {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private currentData: BrainwaveData | null = null;
  private demoInterval: NodeJS.Timeout | null = null;
  private isDemoMode = false;
  private isAuthenticated = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private config: NeuroSkyConfig = {}) {
    super();
    this.config = {
      host: '127.0.0.1',
      port: 13854, // ThinkGear Connector default port
      appName: 'MandalaMind',
      appKey: '0fc2141b1b45c573cc2d3a763b8d71c5bde2391b', // Default public key from NeuroSky
      autoConnect: false,
      demoMode: false,
      enableRawOutput: false,
      ...config
    };
    this.isDemoMode = this.config.demoMode || false;
  }

  async connect(): Promise<void> {
    try {
      // If in demo mode, start simulation instead of real connection
      if (this.isDemoMode) {
        this.startDemoMode();
        return;
      }

      // Check if ThinkGear Connector is available first
      const isAvailable = await NeuroSkyService.checkThinkGearConnector();
      if (!isAvailable) {
        throw new Error('ThinkGear Connector is not running. Please start the ThinkGear Connector application and ensure your NeuroSky device is connected.');
      }

      // Connect to ThinkGear Connector using TCP Socket
      this.socket = new Socket();
      this.isConnected = false;
      this.isAuthenticated = false;
      
      this.socket.on('connect', () => {
        console.log('Connected to NeuroSky ThinkGear Connector');
        this.isConnected = true;
        
        // Send authentication message as required by ThinkGear Connector
        const authMessage = {
          appName: this.config.appName || 'MandalaMind',
          appKey: this.config.appKey || '0fc2141b1b45c573cc2d3a763b8d71c5bde2391b',
          format: 'Json',
          enableRawOutput: this.config.enableRawOutput || false
        };
        
        this.socket!.write(JSON.stringify(authMessage));
        console.log('Sent authentication to ThinkGear Connector:', authMessage.appName);
      });

      this.socket.on('data', (data: Buffer) => {
        try {
          const dataStr = data.toString().trim();
          // Handle multiple JSON messages in one data packet
          const lines = dataStr.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const message = JSON.parse(line);
              this.handleThinkGearMessage(message);
            } catch (parseError) {
              console.error('Error parsing ThinkGear message line:', line, parseError);
            }
          }
        } catch (error) {
          console.error('Error processing ThinkGear data:', error);
        }
      });

      this.socket.on('close', () => {
        console.log('NeuroSky connection closed');
        this.isConnected = false;
        this.isAuthenticated = false;
        this.emit('disconnected');
        
        if (this.config.autoConnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });

      this.socket.on('error', (error: any) => {
        console.error('NeuroSky connection error:', error);
        this.isConnected = false;
        this.isAuthenticated = false;
        
        let errorMessage = error.message || 'Connection error';
        if (error.code === 'ECONNREFUSED') {
          errorMessage = 'ThinkGear Connector is not running. Please start the ThinkGear Connector application, connect your NeuroSky device, and try again.';
        } else if (error.code === 'ENOTFOUND') {
          errorMessage = 'Cannot reach ThinkGear Connector. Please ensure it is installed and running.';
        }
        
        this.emit('error', new Error(errorMessage));
      });

      // Connect to the ThinkGear Connector
      this.socket.connect(this.config.port!, this.config.host!);
      
    } catch (error) {
      console.error('Failed to connect to NeuroSky:', error);
      this.reconnectAttempts++;
      throw error;
    }
  }

  private handleThinkGearMessage(message: any): void {
    // Handle authentication response first
    if (!this.isAuthenticated) {
      if (message.status && message.status === 'success') {
        this.isAuthenticated = true;
        this.reconnectAttempts = 0; // Reset on successful connection
        console.log('ThinkGear Connector authentication successful');
        this.emit('connected');
        return;
      } else if (message.status && message.status === 'error') {
        console.error('ThinkGear Connector authentication failed:', message.message);
        this.emit('error', new Error(`Authentication failed: ${message.message || 'Invalid app key'}`));
        return;
      }
    }

    // Handle data messages only after authentication
    if (!this.isAuthenticated) {
      return;
    }

    // ThinkGear JSON format includes eSense values and signal quality
    const data: Partial<BrainwaveData> = {};
    let hasValidData = false;

    // Extract eSense data (attention and meditation)
    if (message.eSense && typeof message.eSense === 'object') {
      if (typeof message.eSense.attention === 'number' && message.eSense.attention >= 0) {
        data.attention = Math.min(100, Math.max(0, message.eSense.attention));
        hasValidData = true;
      }
      if (typeof message.eSense.meditation === 'number' && message.eSense.meditation >= 0) {
        data.meditation = Math.min(100, Math.max(0, message.eSense.meditation));
        hasValidData = true;
      }
    }

    // Extract signal quality from poorSignalLevel
    if (typeof message.poorSignalLevel === 'number') {
      // Convert poor signal level (0-200) to signal quality (100-0)
      // 0 = perfect signal, 200 = no signal
      const signalQuality = Math.max(0, Math.min(100, 100 - (message.poorSignalLevel / 200) * 100));
      data.signalQuality = Math.round(signalQuality);
      hasValidData = true;
    }

    // Only emit data if we have valid measurements
    if (hasValidData) {
      this.currentData = {
        attention: data.attention ?? this.currentData?.attention ?? 0,
        meditation: data.meditation ?? this.currentData?.meditation ?? 0,
        signalQuality: data.signalQuality ?? this.currentData?.signalQuality ?? 0,
        timestamp: Date.now()
      };

      this.emit('data', this.currentData);
    }

    // Handle blink detection
    if (typeof message.blinkStrength === 'number' && message.blinkStrength > 0) {
      this.emit('blink', { strength: message.blinkStrength, timestamp: Date.now() });
    }

    // Handle raw EEG data if enabled
    if (typeof message.rawEeg === 'number') {
      this.emit('rawEeg', { value: message.rawEeg, timestamp: Date.now() });
    }

    // Handle EEG power bands if available
    if (message.eegPower && typeof message.eegPower === 'object') {
      this.emit('eegPower', { 
        ...message.eegPower, 
        timestamp: Date.now() 
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
    }

    // Only attempt reconnection if auto-connect is enabled and haven't exceeded max attempts
    if (this.config.autoConnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(30000, 5000 * Math.pow(2, this.reconnectAttempts)); // Exponential backoff, max 30s
      
      this.reconnectInterval = setTimeout(() => {
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect to NeuroSky... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnection attempts reached. Stopping automatic reconnection.');
            this.emit('error', new Error('Could not reconnect to ThinkGear Connector after multiple attempts.'));
          }
        });
      }, delay);
    }
  }

  disconnect(): void {
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.isConnected = false;
    this.isAuthenticated = false;
    this.isDemoMode = false;
    this.reconnectAttempts = 0;
    this.emit('disconnected');
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getCurrentData(): BrainwaveData | null {
    return this.currentData;
  }

  enableDemoMode(): void {
    this.isDemoMode = true;
    this.config.demoMode = true;
    
    // Disconnect any real connection first
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    
    // Clear any existing intervals
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    // Start demo mode immediately
    this.startDemoMode();
  }

  disableDemoMode(): void {
    this.isDemoMode = false;
    this.config.demoMode = false;
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
    this.isConnected = false;
    this.emit('disconnected');
    
    // Clear any socket connection if exists
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  private startDemoMode(): void {
    console.log('Starting NeuroSky demo mode');
    this.isConnected = true;
    this.emit('connected');

    // Generate realistic demo data every 250ms (4Hz)
    this.demoInterval = setInterval(() => {
      this.generateDemoData();
    }, 250);
  }

  private generateDemoData(): void {
    // Generate more sophisticated demo data that simulates different mental states
    const time = Date.now() / 1000;
    
    // Create different phases of meditation/concentration
    const phase = Math.floor(time / 30) % 4; // 30-second phases
    
    let baseAttention: number;
    let baseMeditation: number;
    let signalVariation: number;
    
    switch (phase) {
      case 0: // Settling in phase
        baseAttention = 20 + 15 * Math.sin(time * 0.02);
        baseMeditation = 15 + 20 * Math.sin(time * 0.015);
        signalVariation = 15;
        break;
      case 1: // Building focus
        baseAttention = 45 + 25 * Math.sin(time * 0.01);
        baseMeditation = 30 + 25 * Math.cos(time * 0.012);
        signalVariation = 10;
        break;
      case 2: // Deep meditation
        baseAttention = 25 + 15 * Math.sin(time * 0.008);
        baseMeditation = 60 + 20 * Math.cos(time * 0.01);
        signalVariation = 8;
        break;
      default: // Mixed state
        baseAttention = 40 + 20 * Math.sin(time * 0.015);
        baseMeditation = 45 + 15 * Math.cos(time * 0.018);
        signalVariation = 12;
    }
    
    // Add realistic noise and micro-fluctuations
    const attention = Math.max(0, Math.min(100, Math.round(
      baseAttention + 
      signalVariation * (Math.random() - 0.5) + 
      3 * Math.sin(time * 0.5) + // Breathing influence
      2 * Math.sin(time * 2) // Micro-movements
    )));
    
    const meditation = Math.max(0, Math.min(100, Math.round(
      baseMeditation + 
      (signalVariation * 0.8) * (Math.random() - 0.5) + 
      4 * Math.cos(time * 0.3) + // Relaxation waves
      1.5 * Math.cos(time * 1.5) // Natural variance
    )));
    
    // Signal quality with occasional drops (headset movement simulation)
    let baseSignalQuality = 88 + 8 * Math.sin(time * 0.003);
    if (Math.random() < 0.05) { // 5% chance of signal drop
      baseSignalQuality -= 20 + 15 * Math.random();
    }
    
    const signalQuality = Math.max(30, Math.min(100, Math.round(
      baseSignalQuality + 6 * (Math.random() - 0.5)
    )));

    this.currentData = {
      attention,
      meditation,
      signalQuality,
      timestamp: Date.now()
    };

    this.emit('data', this.currentData);

    // More realistic blink patterns
    const blinkChance = 0.015 + 0.01 * Math.sin(time * 0.1); // Variable blink rate
    if (Math.random() < blinkChance) {
      const strength = Math.round(25 + 40 * Math.random());
      this.emit('blink', { strength, timestamp: Date.now() });
    }
    
    // Simulate EEG power bands occasionally
    if (Math.random() < 0.1) { // 10% chance
      this.emit('eegPower', {
        delta: Math.round(200000 + 100000 * Math.random()),
        theta: Math.round(15000 + 10000 * Math.random()),
        lowAlpha: Math.round(2000 + 3000 * Math.random()),
        highAlpha: Math.round(1500 + 2000 * Math.random()),
        lowBeta: Math.round(800 + 1200 * Math.random()),
        highBeta: Math.round(600 + 800 * Math.random()),
        lowGamma: Math.round(400 + 600 * Math.random()),
        highGamma: Math.round(200 + 400 * Math.random()),
        timestamp: Date.now()
      });
    }
  }

  // Static method to check if ThinkGear Connector is available
  static async checkThinkGearConnector(host: string = '127.0.0.1', port: number = 13854): Promise<boolean> {
    return new Promise((resolve) => {
      const testSocket = new Socket();
      const timeout = setTimeout(() => {
        testSocket.destroy();
        resolve(false);
      }, 3000);

      testSocket.on('connect', () => {
        clearTimeout(timeout);
        testSocket.destroy();
        resolve(true);
      });

      testSocket.on('error', () => {
        clearTimeout(timeout);
        testSocket.destroy();
        resolve(false);
      });

      testSocket.connect(port, host);
    });
  }

  // Get detailed connection information
  getConnectionInfo() {
    return {
      isConnected: this.isConnected,
      isAuthenticated: this.isAuthenticated,
      isDemoMode: this.isDemoMode,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      config: {
        host: this.config.host,
        port: this.config.port,
        appName: this.config.appName
      }
    };
  }

  // Reset reconnection attempts
  resetReconnectionAttempts(): void {
    this.reconnectAttempts = 0;
  }
}
