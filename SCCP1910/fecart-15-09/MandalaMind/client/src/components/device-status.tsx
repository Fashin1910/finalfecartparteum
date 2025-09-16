import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Brain, Mic, Cloud, Plug, Cpu, AlertCircle, CheckCircle, Loader2, Zap, Info, ExternalLink } from "lucide-react";
import { UseWebSocketReturn } from "@/hooks/use-websocket";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DeviceStatusProps {
  websocket: UseWebSocketReturn;
  microphoneEnabled: boolean;
  onConnectNeuroSky: () => void;
  onDisconnectNeuroSky: () => void;
}

export function DeviceStatus({ 
  websocket, 
  microphoneEnabled, 
  onConnectNeuroSky, 
  onDisconnectNeuroSky 
}: DeviceStatusProps) {
  const { isConnected, neuroskyConnected, eegData } = websocket;
  const { toast } = useToast();
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isTogglingDemo, setIsTogglingDemo] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string>('');
  const [connectionHelp, setConnectionHelp] = useState<any>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // Signal quality assessment
  const getSignalQuality = () => {
    if (!eegData) return { quality: 'No Signal', color: 'bg-gray-500', level: 0 };
    
    const signalQuality = eegData.signalQuality;
    if (signalQuality >= 80) return { quality: 'Excellent', color: 'bg-green-500', level: 5 };
    if (signalQuality >= 60) return { quality: 'Good', color: 'bg-green-400', level: 4 };
    if (signalQuality >= 40) return { quality: 'Fair', color: 'bg-yellow-500', level: 3 };
    if (signalQuality >= 20) return { quality: 'Poor', color: 'bg-orange-500', level: 2 };
    return { quality: 'Very Poor', color: 'bg-red-500', level: 1 };
  };

  // Check ThinkGear Connector availability
  const checkThinkGearConnector = async () => {
    try {
      const response = await fetch('/api/neurosky/check');
      const data = await response.json();
      
      if (!data.available) {
        setConnectionError(data.message);
        setConnectionHelp(data);
        setShowInstructions(true);
        return false;
      }
      return true;
    } catch (error) {
      setConnectionError('Failed to check ThinkGear Connector status');
      return false;
    }
  };

  // Enhanced connection handlers
  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionError('');
    setConnectionHelp(null);
    
    // Check ThinkGear Connector first
    const isAvailable = await checkThinkGearConnector();
    if (!isAvailable) {
      setIsConnecting(false);
      return;
    }
    
    try {
      const response = await fetch('/api/neurosky/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (!data.success) {
        setConnectionError(data.error);
        if (data.needsSetup) {
          setConnectionHelp({ troubleshooting: data.troubleshooting });
          setShowInstructions(true);
        }
      } else {
        toast({
          title: "Connected!",
          description: data.message,
        });
      }
    } catch (error) {
      setConnectionError('Failed to connect. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setConnectionError('');
      setConnectionHelp(null);
      
      const response = await fetch('/api/neurosky/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      if (data.success) {
        toast({
          title: "Disconnected",
          description: data.message,
        });
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
    
    onDisconnectNeuroSky();
  };

  // Watch connection state changes
  useEffect(() => {
    if (neuroskyConnected) {
      setIsConnecting(false);
      setConnectionError('');
    } else if (isConnecting) {
      // Keep isConnecting true while attempting
    }
  }, [neuroskyConnected, isConnecting]);

  const handleDemoModeToggle = async (enabled: boolean) => {
    setIsTogglingDemo(true);
    try {
      const endpoint = enabled ? '/api/neurosky/demo/enable' : '/api/neurosky/demo/disable';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setIsDemoMode(enabled);
        setConnectionError('');
        setConnectionHelp(null);
        
        toast({
          title: enabled ? "Demo Mode Enabled" : "Demo Mode Disabled",
          description: data.message,
        });
        
        // Show demo info if enabled
        if (enabled && data.demoInfo) {
          setConnectionHelp({ demoInfo: data.demoInfo });
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${enabled ? 'enable' : 'disable'} demo mode`,
        variant: "destructive",
      });
    } finally {
      setIsTogglingDemo(false);
    }
  };

  return (
    <Card className="glass border-border/50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center">
            <Plug className="text-primary mr-3 h-5 w-5" />
            Device Status
          </h3>
          
          {neuroskyConnected ? (
            <Button 
              onClick={handleDisconnect}
              variant="outline" 
              size="sm"
              className="touch-manipulation min-h-[36px]"
              data-testid="button-disconnect-neurosky"
            >
              Disconnect
            </Button>
          ) : (
            <Button 
              onClick={handleConnect}
              variant="default" 
              size="sm"
              className="touch-manipulation min-h-[36px]"
              disabled={isConnecting}
              data-testid="button-connect-neurosky"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </Button>
          )}
        </div>
        
        <div className="space-y-4">
          {/* Demo Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center space-x-3">
              <Cpu className="text-primary h-5 w-5" />
              <div>
                <span className="font-medium">Demo Mode</span>
                <p className="text-xs text-muted-foreground">Simulate brain waves for testing</p>
              </div>
            </div>
            <Switch
              checked={isDemoMode}
              onCheckedChange={handleDemoModeToggle}
              disabled={isTogglingDemo}
              data-testid="switch-demo-mode"
            />
          </div>

          {/* NeuroSky Connection */}
          <div className="p-3 bg-secondary/30 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Brain className="text-primary h-5 w-5" />
                <span data-testid="text-neurosky-label">
                  {isDemoMode ? 'Simulated Brain Waves' : 'NeuroSky Headset'}
                </span>
              </div>
              <Badge 
                variant={neuroskyConnected ? "default" : isConnecting ? "secondary" : "destructive"}
                data-testid="badge-neurosky-status"
              >
                <div className={`w-2 h-2 rounded-full mr-2 ${
                  neuroskyConnected ? 'bg-green-500' : 
                  isConnecting ? 'bg-yellow-500' :
                  'bg-red-500'
                }`} />
                {neuroskyConnected ? (isDemoMode ? 'Simulating' : 'Connected') : 
                 isConnecting ? 'Connecting...' : 'Disconnected'}
              </Badge>
            </div>

            {/* Signal Quality Indicator */}
            {neuroskyConnected && eegData && (
              <div className="flex items-center space-x-2 text-xs">
                <Zap className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Signal Quality:</span>
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${getSignalQuality().color}`} />
                  <span className="font-medium">{getSignalQuality().quality}</span>
                  <span className="text-muted-foreground">({eegData.signalQuality}%)</span>
                </div>
              </div>
            )}
          </div>

          {/* Connection Error */}
          {connectionError && (
            <Alert className="border-destructive/50 bg-destructive/10">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription>{connectionError}</AlertDescription>
            </Alert>
          )}
          
          {/* Setup Instructions */}
          {connectionHelp && showInstructions && (
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">ThinkGear Connector Setup Required</AlertTitle>
              <AlertDescription>
                <div className="space-y-3 mt-2 text-blue-700">
                  <p>Follow these steps to connect your NeuroSky device:</p>
                  
                  {connectionHelp.instructions && (
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded border">
                        <h4 className="font-medium mb-2 flex items-center">🖥️ Windows Instructions:</h4>
                        <ol className="list-decimal list-inside text-sm space-y-1 text-gray-700">
                          {connectionHelp.instructions.windows.map((step: string, index: number) => (
                            <li key={index}>{step}</li>
                          ))}
                        </ol>
                      </div>
                      
                      <div className="bg-white p-3 rounded border">
                        <h4 className="font-medium mb-2 flex items-center">🍎 macOS Instructions:</h4>
                        <ol className="list-decimal list-inside text-sm space-y-1 text-gray-700">
                          {connectionHelp.instructions.mac.map((step: string, index: number) => (
                            <li key={index}>{step}</li>
                          ))}
                        </ol>
                      </div>
                      
                      <div className="bg-white p-3 rounded border">
                        <h4 className="font-medium mb-2 flex items-center">🔧 Troubleshooting:</h4>
                        <ul className="list-disc list-inside text-sm space-y-1 text-gray-700">
                          {connectionHelp.instructions.troubleshooting.map((tip: string, index: number) => (
                            <li key={index}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  {connectionHelp.troubleshooting && (
                    <div className="bg-white p-3 rounded border">
                      <h4 className="font-medium mb-2 flex items-center">💡 Quick Fixes:</h4>
                      <ul className="list-disc list-inside text-sm space-y-1 text-gray-700">
                        {connectionHelp.troubleshooting.map((tip: string, index: number) => (
                          <li key={index}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="flex gap-2 mt-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowInstructions(false)}
                    >
                      Hide Instructions
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleConnect}
                      disabled={isConnecting}
                    >
                      {isConnecting ? 'Connecting...' : 'Try Again'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => window.open('https://developer.neurosky.com/docs/doku.php?id=thinkgear_connector_tgc', '_blank')}
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Download TGC
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Demo Mode Info */}
          {connectionHelp?.demoInfo && (
            <Alert className="border-green-200 bg-green-50">
              <Info className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Demo Mode Active</AlertTitle>
              <AlertDescription>
                <div className="space-y-2 mt-2 text-green-700">
                  <p>{connectionHelp.demoInfo.description}</p>
                  <div className="bg-white p-2 rounded border">
                    <h4 className="font-medium mb-1">Simulation Phases:</h4>
                    <ol className="list-decimal list-inside text-sm space-y-1 text-gray-700">
                      {connectionHelp.demoInfo.phases.map((phase: string, index: number) => (
                        <li key={index}>{phase}</li>
                      ))}
                    </ol>
                  </div>
                  <p className="text-sm text-green-600">{connectionHelp.demoInfo.note}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Connection Tips for Disconnected State */}
          {!neuroskyConnected && !isConnecting && !connectionError && !isDemoMode && (
            <Alert className="border-blue-200 bg-blue-50">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800">Ready to Connect</AlertTitle>
              <AlertDescription className="text-blue-700">
                <div className="space-y-2">
                  <p>Before connecting, ensure:</p>
                  <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                    <li>ThinkGear Connector is running on your computer</li>
                    <li>Your NeuroSky headset is powered on (LED blinking blue)</li>
                    <li>The headset is connected in ThinkGear Connector</li>
                    <li>No other applications are using the device</li>
                  </ul>
                  <div className="mt-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={async () => {
                        const isAvailable = await checkThinkGearConnector();
                        if (!isAvailable) {
                          setShowInstructions(true);
                        } else {
                          toast({
                            title: "ThinkGear Connector Ready",
                            description: "Your connector is running and ready for connection!",
                          });
                        }
                      }}
                    >
                      Check Setup
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* WebSocket Connection */}
          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <div className="flex items-center space-x-3">
              <Cloud className="text-secondary h-5 w-5" />
              <span data-testid="text-websocket-label">WebSocket</span>
            </div>
            <Badge 
              variant={isConnected ? "default" : "destructive"}
              data-testid="badge-websocket-status"
            >
              <div className={`w-2 h-2 rounded-full mr-2 ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>

          {/* Mic Status */}
          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <div className="flex items-center space-x-3">
              <Mic className="text-accent h-5 w-5" />
              <span data-testid="text-microphone-label">Mic</span>
            </div>
            <Badge 
              variant={microphoneEnabled ? "default" : "secondary"}
              data-testid="badge-microphone-status"
            >
              <div className={`w-2 h-2 rounded-full mr-2 ${
                microphoneEnabled ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              {microphoneEnabled ? 'Ready' : 'Permission Needed'}
            </Badge>
          </div>

          {/* API Services */}
          <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
            <div className="flex items-center space-x-3">
              <Cloud className="text-primary h-5 w-5" />
              <span data-testid="text-api-label">AI Services</span>
            </div>
            <Badge variant="default" data-testid="badge-api-status">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              Ready
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
