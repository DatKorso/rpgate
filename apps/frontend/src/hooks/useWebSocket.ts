import { useEffect, useRef, useState } from 'react';
import { getWebSocketClient } from '../lib/websocket';
import type { WebSocketUser } from '@rpgate/shared/types';
import { WEBSOCKET_EVENTS } from '@rpgate/shared/constants';

interface UseWebSocketOptions {
  user?: WebSocketUser;
  autoConnect?: boolean;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { user, autoConnect = false } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsClient = useRef(getWebSocketClient());

  useEffect(() => {
    if (autoConnect && user) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, user]);

  const connect = async () => {
    if (!user) {
      setError('User is required to connect');
      return;
    }

    try {
      await wsClient.current.connect(user);
      setIsConnected(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    wsClient.current.disconnect();
    setIsConnected(false);
  };

  const sendMessage = (roomId: string, content: string) => {
    wsClient.current.sendMessage(roomId, content);
  };

  const joinRoom = (roomId: string) => {
    wsClient.current.joinRoom(roomId);
  };

  const leaveRoom = (roomId: string) => {
    wsClient.current.leaveRoom(roomId);
  };

  const startTyping = (roomId: string) => {
    wsClient.current.startTyping(roomId);
  };

  const stopTyping = (roomId: string) => {
    wsClient.current.stopTyping(roomId);
  };

  // Event subscription helpers
  const onMessage = (callback: (message: any) => void) => {
    wsClient.current.on(WEBSOCKET_EVENTS.MESSAGE_NEW, callback);
    return () => wsClient.current.off(WEBSOCKET_EVENTS.MESSAGE_NEW, callback);
  };

  const onUserJoined = (callback: (data: any) => void) => {
    wsClient.current.on(WEBSOCKET_EVENTS.USER_JOINED, callback);
    return () => wsClient.current.off(WEBSOCKET_EVENTS.USER_JOINED, callback);
  };

  const onUserLeft = (callback: (data: any) => void) => {
    wsClient.current.on(WEBSOCKET_EVENTS.USER_LEFT, callback);
    return () => wsClient.current.off(WEBSOCKET_EVENTS.USER_LEFT, callback);
  };

  const onTypingStart = (callback: (data: any) => void) => {
    wsClient.current.on(WEBSOCKET_EVENTS.TYPING_START, callback);
    return () => wsClient.current.off(WEBSOCKET_EVENTS.TYPING_START, callback);
  };

  const onTypingStop = (callback: (data: any) => void) => {
    wsClient.current.on(WEBSOCKET_EVENTS.TYPING_STOP, callback);
    return () => wsClient.current.off(WEBSOCKET_EVENTS.TYPING_STOP, callback);
  };

  const onError = (callback: (error: any) => void) => {
    wsClient.current.on(WEBSOCKET_EVENTS.ERROR, callback);
    return () => wsClient.current.off(WEBSOCKET_EVENTS.ERROR, callback);
  };

  return {
    isConnected,
    error,
    connect,
    disconnect,
    sendMessage,
    joinRoom,
    leaveRoom,
    startTyping,
    stopTyping,
    onMessage,
    onUserJoined,
    onUserLeft,
    onTypingStart,
    onTypingStop,
    onError,
  };
}