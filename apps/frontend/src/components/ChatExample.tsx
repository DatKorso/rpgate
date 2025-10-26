import { useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface ChatExampleProps {
  user: {
    userId: string;
    username: string;
  };
  roomId: string;
}

export function ChatExample({ user, roomId }: ChatExampleProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const {
    isConnected,
    error,
    connect,
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
  } = useWebSocket({ user, autoConnect: true });

  useEffect(() => {
    if (isConnected) {
      joinRoom(roomId);
    }

    return () => {
      if (isConnected) {
        leaveRoom(roomId);
      }
    };
  }, [isConnected, roomId]);

  useEffect(() => {
    const unsubscribeMessage = onMessage((message) => {
      setMessages(prev => [...prev, message]);
    });

    const unsubscribeUserJoined = onUserJoined((data) => {
      console.log('User joined:', data);
    });

    const unsubscribeUserLeft = onUserLeft((data) => {
      console.log('User left:', data);
    });

    const unsubscribeTypingStart = onTypingStart((data) => {
      setTypingUsers(prev => [...prev.filter(id => id !== data.userId), data.userId]);
    });

    const unsubscribeTypingStop = onTypingStop((data) => {
      setTypingUsers(prev => prev.filter(id => id !== data.userId));
    });

    return () => {
      unsubscribeMessage();
      unsubscribeUserJoined();
      unsubscribeUserLeft();
      unsubscribeTypingStart();
      unsubscribeTypingStop();
    };
  }, []);

  const handleSendMessage = () => {
    if (newMessage.trim() && isConnected) {
      sendMessage(roomId, newMessage.trim());
      setNewMessage('');
    }
  };

  const handleTyping = (value: string) => {
    setNewMessage(value);
    
    if (value.length > 0) {
      startTyping(roomId);
    } else {
      stopTyping(roomId);
    }
  };

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        Error: {error}
        <button 
          onClick={connect}
          className="ml-2 px-2 py-1 bg-red-500 text-white rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
      <div className="bg-blue-500 text-white p-4">
        <h2 className="text-lg font-semibold">Chat Room: {roomId}</h2>
        <p className="text-sm opacity-90">
          Status: {isConnected ? 'Connected' : 'Disconnected'}
        </p>
      </div>

      <div className="h-64 overflow-y-auto p-4 space-y-2">
        {messages.map((message, index) => (
          <div key={index} className="bg-gray-100 p-2 rounded">
            <div className="font-semibold text-sm text-blue-600">
              {message.username}
            </div>
            <div className="text-gray-800">{message.content}</div>
          </div>
        ))}
        
        {typingUsers.length > 0 && (
          <div className="text-sm text-gray-500 italic">
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}
      </div>

      <div className="p-4 border-t">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={!isConnected}
          />
          <button
            onClick={handleSendMessage}
            disabled={!isConnected || !newMessage.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}