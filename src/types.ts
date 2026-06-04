export type DeviceType = 'PC' | 'Phone' | 'Tablet';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  joinedAt: number;
}

export interface TransferFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number; // 0 to 100
  status: 'waiting' | 'transferring' | 'completed' | 'failed' | 'cancelled';
  direction: 'send' | 'receive';
  speed: number; // bytes per second
  timeRemaining: number; // seconds
  chunksCompleted: number;
  totalChunks: number;
  url?: string;
  blob?: Blob;
}

export interface TransferLog {
  id: string;
  fileName: string;
  size: number;
  status: 'completed' | 'failed';
  timestamp: number;
  direction: 'send' | 'receive';
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface RoomState {
  roomId: string;
  devices: Device[];
}
