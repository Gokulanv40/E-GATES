import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';

export const SocketContext = createContext(null);

const getSocketUrl = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return import.meta.env.VITE_SOCKET_URL || 'http://localhost:5002';
};

const SOCKET_URL = getSocketUrl();

export const SocketProvider = ({ children }) => {
  const { token, isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let newSocket = null;

    if (isAuthenticated && token) {
      newSocket = io(SOCKET_URL, {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      newSocket.on('connect', () => {
        setIsConnected(true);
        // Automatically join association room if user has association_id
        if (user?.association_id) {
          newSocket.emit('join:association', { associationId: user.association_id });
        }
      });

      newSocket.on('disconnect', (reason) => {
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.warn('Socket connection error:', error?.message);
        setIsConnected(false);
      });

      setSocket(newSocket);
    } else {
      if (socket) {
        socket.disconnect();
      }
      setSocket(null);
      setIsConnected(false);
    }

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isAuthenticated, token, user?.association_id]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;
