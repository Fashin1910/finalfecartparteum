import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { NeuroSkyService } from "./services/neurosky";
import { GeminiService } from "./services/gemini";
import { insertSessionSchema, insertMandalaSchema, type GenerateMandalaRequest, type BrainwaveData } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize services
  const neuroskyService = new NeuroSkyService({ autoConnect: false });
  const geminiService = new GeminiService();
  
  // WebSocket server for real-time EEG data streaming
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<WebSocket>();
  
  // WebSocket connection handling
  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    clients.add(ws);
    
    // Send current connection status
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'connection_status',
        connected: neuroskyService.getConnectionStatus(),
        currentData: neuroskyService.getCurrentData()
      }));
    }
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'connect_neurosky':
            try {
              await neuroskyService.connect();
            } catch (error) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to connect to NeuroSky device'
              }));
            }
            break;
            
          case 'disconnect_neurosky':
            neuroskyService.disconnect();
            break;
            
          case 'enable_demo':
            try {
              // Disconnect any real connection first
              if (neuroskyService.getConnectionStatus()) {
                neuroskyService.disconnect();
              }
              
              neuroskyService.enableDemoMode();
              
              ws.send(JSON.stringify({
                type: 'demo_enabled',
                message: 'Demo mode enabled - generating simulated brainwave data'
              }));
            } catch (error) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to enable demo mode'
              }));
            }
            break;
            
          case 'disable_demo':
            try {
              neuroskyService.disableDemoMode();
              ws.send(JSON.stringify({
                type: 'demo_disabled',
                message: 'Demo mode disabled - ready for real NeuroSky connection'
              }));
            } catch (error) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to disable demo mode'
              }));
            }
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected from WebSocket');
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });
  
  // Broadcast function for real-time data
  function broadcast(data: any) {
    const message = JSON.stringify(data);
    clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  // NeuroSky event handlers
  neuroskyService.on('connected', () => {
    broadcast({ type: 'neurosky_connected' });
  });
  
  neuroskyService.on('disconnected', () => {
    broadcast({ type: 'neurosky_disconnected' });
  });
  
  neuroskyService.on('data', async (data: BrainwaveData) => {
    broadcast({ type: 'eeg_data', data });
    
    // Store EEG data for active sessions
    try {
      const activeSessions = await storage.getActiveSessions();
      for (const session of activeSessions) {
        await storage.addEegData({
          sessionId: session.id,
          attention: data.attention,
          meditation: data.meditation,
          signalQuality: data.signalQuality,
          rawData: data
        });
      }
    } catch (error) {
      console.error('Error storing EEG data:', error);
    }
  });
  
  neuroskyService.on('error', (error) => {
    broadcast({ type: 'neurosky_error', error: error.message });
  });
  
  // API Routes
  
  // Create a new session
  app.post("/api/sessions", async (req, res) => {
    try {
      const validatedData = insertSessionSchema.parse(req.body);
      const session = await storage.createSession(validatedData);
      res.json(session);
    } catch (error) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Invalid session data' 
      });
    }
  });
  
  // Get session by ID
  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get session' 
      });
    }
  });
  
  // Update session
  app.patch("/api/sessions/:id", async (req, res) => {
    try {
      const updates = insertSessionSchema.partial().parse(req.body);
      const session = await storage.updateSession(req.params.id, updates);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    } catch (error) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : 'Invalid update data' 
      });
    }
  });
  
  // Get recent mandalas
  app.get("/api/mandalas/recent", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 6;
      const mandalas = await storage.getRecentMandalas(limit);
      res.json(mandalas);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get mandalas' 
      });
    }
  });
  
  // Get mandala by ID
  app.get("/api/mandalas/:id", async (req, res) => {
    try {
      const mandala = await storage.getMandala(req.params.id);
      if (!mandala) {
        return res.status(404).json({ error: 'Mandala not found' });
      }
      res.json(mandala);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get mandala' 
      });
    }
  });

  // Serve mandala image directly
  app.get("/api/mandalas/:id/image", async (req, res) => {
    try {
      const mandala = await storage.getMandala(req.params.id);
      if (!mandala) {
        return res.status(404).json({ error: 'Mandala not found' });
      }

      // Handle data URLs (locally generated SVG mandalas)
      if (mandala.imageUrl.startsWith('data:')) {
        const [header, base64Data] = mandala.imageUrl.split(',');
        const mimeMatch = header.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/svg+xml';
        
        const buffer = Buffer.from(base64Data, 'base64');
        
        res.set({
          'Content-Type': mimeType,
          'Content-Length': buffer.length,
          'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
          'ETag': `"${req.params.id}"`
        });
        
        res.send(buffer);
      } else {
        // Handle external URLs (OpenAI generated images) - redirect
        res.redirect(302, mandala.imageUrl);
      }
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to serve mandala image' 
      });
    }
  });
  
  // Generate mandala
  app.post("/api/mandalas/generate", async (req, res) => {
    try {
      const generateSchema = z.object({
        voiceTranscript: z.string().min(1, "Voice transcript is required"),
        brainwaveData: z.object({
          attention: z.number().min(0).max(100),
          meditation: z.number().min(0).max(100),
          signalQuality: z.number().min(0).max(100),
          timestamp: z.number()
        }),
        sessionId: z.string(),
        style: z.enum(['traditional', 'modern', 'abstract', 'spiritual']).optional(),
        colorPalette: z.enum(['warm', 'cool', 'vibrant', 'monochrome']).optional()
      });
      
      const data = generateSchema.parse(req.body);
      
      // Verify session exists
      const session = await storage.getSession(data.sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Generate AI prompt using Gemini
      const prompt = await geminiService.generateMandalaPrompt({
        voiceTranscript: data.voiceTranscript,
        brainwaveData: data.brainwaveData,
        style: data.style,
        colorPalette: data.colorPalette
      });
      
      // Generate mandala image using Gemini
      const generatedMandala = await geminiService.generateMandalaImage(prompt, data.brainwaveData);
      
      // Store mandala
      const mandala = await storage.createMandala({
        sessionId: data.sessionId,
        imageUrl: generatedMandala.imageUrl,
        prompt: generatedMandala.prompt,
        brainwaveData: data.brainwaveData,
        voiceTranscript: data.voiceTranscript
      });
      
      // Update session with latest data
      await storage.updateSession(data.sessionId, {
        voiceTranscript: data.voiceTranscript,
        aiPrompt: prompt,
        mandalaUrl: generatedMandala.imageUrl,
        attentionLevel: data.brainwaveData.attention,
        meditationLevel: data.brainwaveData.meditation,
        signalQuality: data.brainwaveData.signalQuality
      });
      
      // Broadcast to connected clients
      broadcast({
        type: 'mandala_generated',
        mandala,
        generatedMandala
      });
      
      res.json({
        mandala,
        generatedPrompt: prompt,
        imageUrl: generatedMandala.imageUrl,
        revisedPrompt: generatedMandala.revisedPrompt
      });
      
    } catch (error: any) {
      console.error('Error generating mandala:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to generate mandala';
      let errorCode = 500;
      
      if (error?.code === 'insufficient_quota' || error?.code === 'billing_hard_limit_reached') {
        errorMessage = 'API quota exceeded. Using fallback mandala generation...';
        errorCode = 503; // Service temporarily unavailable
      } else if (error?.status === 429) {
        errorMessage = 'Too many requests. Please try again in a few minutes.';
        errorCode = 429;
      } else if (error?.message?.includes('network') || error?.message?.includes('timeout')) {
        errorMessage = 'Connection problem. Please try again.';
        errorCode = 502; // Bad gateway
      }
      
      res.status(errorCode).json({ 
        error: errorMessage,
        details: error instanceof Error ? error.message : 'Unknown error',
        fallbackAvailable: true
      });
    }
  });
  
  // Get EEG data for session
  app.get("/api/sessions/:id/eeg", async (req, res) => {
    try {
      const eegData = await storage.getEegDataForSession(req.params.id);
      res.json(eegData);
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get EEG data' 
      });
    }
  });
  
  // Get current NeuroSky status with detailed information
  app.get("/api/neurosky/status", (req, res) => {
    res.json({
      connected: neuroskyService.getConnectionStatus(),
      currentData: neuroskyService.getCurrentData(),
      connectionInfo: neuroskyService.getConnectionInfo()
    });
  });
  
  // Connect to NeuroSky with better error handling
  app.post("/api/neurosky/connect", async (req, res) => {
    try {
      // Reset reconnection attempts before trying
      neuroskyService.resetReconnectionAttempts();
      
      // Check if ThinkGear Connector is available first
      const isAvailable = await NeuroSkyService.checkThinkGearConnector();
      if (!isAvailable) {
        return res.status(503).json({ 
          success: false,
          error: 'ThinkGear Connector is not running',
          message: 'Please start ThinkGear Connector and connect your NeuroSky device first',
          needsSetup: true
        });
      }
      
      await neuroskyService.connect();
      
      // Broadcast connection success to WebSocket clients
      broadcast({ 
        type: 'neurosky_connected',
        connectionInfo: neuroskyService.getConnectionInfo()
      });
      
      res.json({ 
        success: true, 
        message: 'Successfully connected to NeuroSky device via ThinkGear Connector',
        connectionInfo: neuroskyService.getConnectionInfo()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to NeuroSky';
      const needsSetup = errorMessage.includes('ThinkGear Connector');
      
      // Broadcast connection error to WebSocket clients
      broadcast({ 
        type: 'neurosky_error',
        error: errorMessage
      });
      
      res.status(500).json({ 
        success: false,
        error: errorMessage,
        needsSetup,
        troubleshooting: needsSetup ? [
          'Ensure ThinkGear Connector is running',
          'Check that your NeuroSky device is connected in ThinkGear Connector',
          'Try restarting ThinkGear Connector',
          'Make sure the COM port is properly selected'
        ] : [
          'Check your NeuroSky device battery',
          'Ensure proper headset placement',
          'Try disconnecting and reconnecting in ThinkGear Connector'
        ]
      });
    }
  });
  
  // Disconnect from NeuroSky with cleanup
  app.post("/api/neurosky/disconnect", (req, res) => {
    try {
      neuroskyService.disconnect();
      
      // Broadcast disconnection to WebSocket clients
      broadcast({ 
        type: 'neurosky_disconnected',
        connectionInfo: neuroskyService.getConnectionInfo()
      });
      
      res.json({ 
        success: true, 
        message: 'Successfully disconnected from NeuroSky device',
        connectionInfo: neuroskyService.getConnectionInfo()
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Error during disconnection'
      });
    }
  });
  
  // Check if ThinkGear Connector is available with detailed status
  app.get("/api/neurosky/check", async (req, res) => {
    try {
      const available = await NeuroSkyService.checkThinkGearConnector();
      res.json({ 
        available,
        status: available ? 'ready' : 'not_running',
        message: available 
          ? 'ThinkGear Connector is running and ready for connection'
          : 'ThinkGear Connector is not running. Please start the application and connect your NeuroSky device.',
        instructions: {
          windows: [
            'Download and install ThinkGear Connector from NeuroSky developer portal',
            'Power on your NeuroSky headset and wait for the blue light',
            'Open ThinkGear Connector application',
            'Select the correct COM port (usually COM3, COM4, COM5, or COM6)',
            'Click Connect - you should see "Connecting..." then "Connected"',
            'Return to this application and try connecting again'
          ],
          mac: [
            'Download and install ThinkGear Connector for macOS',
            'Power on your NeuroSky headset and pair via Bluetooth',
            'Open ThinkGear Connector application',
            'Select your paired headset from the device list',
            'Click Connect and wait for successful connection',
            'Return to this application and try connecting again'
          ],
          troubleshooting: [
            'Ensure your NeuroSky headset is charged and powered on',
            'Check that the headset is properly paired with your computer',
            'Restart ThinkGear Connector if connection fails',
            'Try different COM ports if using Windows',
            'Make sure no other applications are using the NeuroSky device'
          ]
        }
      });
    } catch (error) {
      res.json({ 
        available: false, 
        status: 'error',
        message: 'Error checking ThinkGear Connector availability',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Enable demo mode with better feedback
  app.post("/api/neurosky/demo/enable", (req, res) => {
    try {
      // Disconnect any real connection first
      if (neuroskyService.getConnectionStatus()) {
        neuroskyService.disconnect();
      }
      
      neuroskyService.enableDemoMode();
      
      // Broadcast demo mode enabled to WebSocket clients
      broadcast({ 
        type: 'demo_enabled',
        message: 'Demo mode enabled - generating simulated brainwave data',
        connectionInfo: neuroskyService.getConnectionInfo()
      });
      
      res.json({ 
        success: true, 
        message: 'Demo mode enabled - generating simulated brainwave data',
        demoInfo: {
          description: 'Demo mode simulates realistic brainwave patterns with 4 phases:',
          phases: [
            'Settling in - Lower attention and meditation as you get comfortable',
            'Building focus - Increasing attention with moderate meditation',
            'Deep meditation - High meditation with relaxed attention',
            'Mixed state - Balanced attention and meditation levels'
          ],
          note: 'Each phase lasts 30 seconds and cycles continuously'
        }
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable demo mode' 
      });
    }
  });

  // Disable demo mode with status update
  app.post("/api/neurosky/demo/disable", (req, res) => {
    try {
      neuroskyService.disableDemoMode();
      
      // Broadcast demo mode disabled to WebSocket clients
      broadcast({ 
        type: 'demo_disabled',
        message: 'Demo mode disabled - ready for real NeuroSky connection',
        connectionInfo: neuroskyService.getConnectionInfo()
      });
      
      res.json({ 
        success: true, 
        message: 'Demo mode disabled - ready for real NeuroSky connection',
        connectionInfo: neuroskyService.getConnectionInfo()
      });
    } catch (error) {
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable demo mode' 
      });
    }
  });
  
  return httpServer;
}
